// ── Config ──────────────────────────────────────────────────
const CONTRACT  = "0x6aE4DAB1f28630d2D56740cF5D8da78d5de01DBf";
const SEPOLIA   = "0xaa36a7";
const RPC_URL   = "https://eth-sepolia.g.alchemy.com/v2/17uczrYjtGkO-dt7QwL5e";
const TRANSFER  = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

let pieInst  = null;
let lineInst = null;
const blockCache = {};

// ─────────────────────────────────────────────────────────────
// CONNECT
// ─────────────────────────────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask not found. Please install it from metamask.io");
    return;
  }
  try {
    document.getElementById("connectBtn").textContent = "Connecting...";
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    await switchToSepolia();
    await onConnect(accounts[0]);

    window.ethereum.on("accountsChanged", (a) => a.length ? onConnect(a[0]) : onDisconnect());
    window.ethereum.on("chainChanged",    ()  => location.reload());
  } catch (e) {
    console.error(e);
    document.getElementById("connectBtn").textContent = "Connect Wallet";
  }
}

// ─────────────────────────────────────────────────────────────
// SWITCH WALLET — opens MetaMask account picker
// ─────────────────────────────────────────────────────────────
async function switchWallet(e) {
  if (e) e.stopPropagation();
  closeDropdown();
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
    const accs = await window.ethereum.request({ method: "eth_accounts" });
    if (accs.length) await onConnect(accs[0]);
  } catch (err) { console.error(err); }
}

// ─────────────────────────────────────────────────────────────
// DISCONNECT
// ─────────────────────────────────────────────────────────────
function disconnectWallet(e) {
  if (e) e.stopPropagation();
  closeDropdown();
  onDisconnect();
}

function onDisconnect() {
  document.getElementById("connectBtn").style.display = "inline-block";
  document.getElementById("connectBtn").textContent = "Connect Wallet";
  document.getElementById("profilePill").style.display = "none";
  document.getElementById("walletSection").style.display  = "none";
  document.getElementById("chartsSection").style.display  = "none";
  if (pieInst)  { pieInst.destroy();  pieInst  = null; }
  if (lineInst) { lineInst.destroy(); lineInst = null; }
}

// ─────────────────────────────────────────────────────────────
// ON CONNECT — update UI then load charts
// ─────────────────────────────────────────────────────────────
async function onConnect(account) {
  const short    = account.slice(0,6) + "..." + account.slice(-4);
  const initials = account.slice(2,4).toUpperCase();

  // Nav pill
  document.getElementById("connectBtn").style.display = "none";
  const pill = document.getElementById("profilePill");
  pill.style.display = "flex";
  document.getElementById("profileAvatar").textContent = initials;
  document.getElementById("profileAddr").textContent   = short;
  document.getElementById("ddAvatar").textContent      = initials;
  document.getElementById("ddAddr").textContent        = short;

  // Balances
  const tc  = await getTCBalance(account);
  const eth = await getETHBalance(account);

  document.getElementById("ddBal").textContent  = tc + " TC";
  document.getElementById("wcAddr").textContent  = short;
  document.getElementById("wcBal").textContent   = tc + " TC";
  document.getElementById("wcEth").textContent   = eth + " ETH";

  document.getElementById("walletSection").style.display  = "block";
  document.getElementById("chartsSection").style.display  = "block";

  // Build charts
  buildPie(parseFloat(tc), parseFloat(eth));
  await buildLine(account);

  // Scroll to wallet card
  document.getElementById("walletSection").scrollIntoView({ behavior: "smooth" });
}

// ─────────────────────────────────────────────────────────────
// DROPDOWN TOGGLE
// ─────────────────────────────────────────────────────────────
function toggleDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById("profileDropdown");
  dd.classList.toggle("open");
}

function closeDropdown() {
  document.getElementById("profileDropdown").classList.remove("open");
}

// Close when clicking anywhere outside
document.addEventListener("click", closeDropdown);

// ─────────────────────────────────────────────────────────────
// SWITCH TO SEPOLIA
// ─────────────────────────────────────────────────────────────
async function switchToSepolia() {
  const chain = await window.ethereum.request({ method: "eth_chainId" });
  if (chain !== SEPOLIA) {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA }],
    });
  }
}

// ─────────────────────────────────────────────────────────────
// BALANCES
// ─────────────────────────────────────────────────────────────
async function getTCBalance(account) {
  try {
    const data   = "0x70a08231" + account.slice(2).padStart(64, "0");
    const result = await window.ethereum.request({
      method: "eth_call", params: [{ to: CONTRACT, data }, "latest"],
    });
    const raw = BigInt(result);
    const whole = raw / BigInt(10 ** 18);
    const frac  = (raw % BigInt(10 ** 18)).toString().padStart(18, "0").slice(0, 2).replace(/0+$/, "");
    return frac ? whole + "." + frac : whole.toString();
  } catch { return "0"; }
}

async function getETHBalance(account) {
  try {
    const result = await window.ethereum.request({
      method: "eth_getBalance", params: [account, "latest"],
    });
    return (Number(BigInt(result)) / 1e18).toFixed(4);
  } catch { return "0"; }
}

// ─────────────────────────────────────────────────────────────
// PIE CHART — portfolio breakdown
// ─────────────────────────────────────────────────────────────
function buildPie(tc, eth) {
  if (pieInst) { pieInst.destroy(); pieInst = null; }

  const labels = [];
  const data   = [];
  const colors = ["#7c3aed", "#06b6d4", "#f59e0b"];

  if (tc  > 0) { labels.push("TCoin (TC)");   data.push(tc);  }
  if (eth > 0) { labels.push("Sepolia ETH");  data.push(eth); }
  if (!data.length) { labels.push("No assets"); data.push(1); }

  const usedColors = colors.slice(0, labels.length);

  pieInst = new Chart(
    document.getElementById("pieChart").getContext("2d"),
    {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: usedColors,
          borderColor: "#16161f",
          borderWidth: 3,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((ctx.raw / total) * 100).toFixed(1);
                return `  ${ctx.label}: ${ctx.raw} (${pct}%)`;
              },
            },
          },
        },
      },
    }
  );

  // Custom legend
  document.getElementById("pieLegend").innerHTML = labels
    .map((l, i) => `
      <div class="leg-item">
        <span class="leg-dot" style="background:${usedColors[i]}"></span>
        <span>${l}: ${data[i]}</span>
      </div>`)
    .join("");
}

// ─────────────────────────────────────────────────────────────
// LINE CHART — transaction history
// ─────────────────────────────────────────────────────────────
async function buildLine(account) {
  if (lineInst) { lineInst.destroy(); lineInst = null; }

  const { labels, received, sent } = await fetchTxHistory(account);

  lineInst = new Chart(
    document.getElementById("lineChart").getContext("2d"),
    {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "TC Received",
            data: received,
            borderColor: "#7c3aed",
            backgroundColor: "rgba(124,58,237,0.15)",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: "#7c3aed",
            borderWidth: 2,
          },
          {
            label: "TC Sent",
            data: sent,
            borderColor: "#06b6d4",
            backgroundColor: "rgba(6,182,212,0.1)",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: "#06b6d4",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#e2e2f0", font: { size: 12 } } },
          tooltip: { callbacks: { label: (c) => `  ${c.dataset.label}: ${c.raw} TC` } },
        },
        scales: {
          x: { ticks: { color: "#8888aa" }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { beginAtZero: true, ticks: { color: "#8888aa" }, grid: { color: "rgba(255,255,255,0.05)" } },
        },
      },
    }
  );
}

// ─────────────────────────────────────────────────────────────
// FETCH TX HISTORY from Alchemy
// ─────────────────────────────────────────────────────────────
async function fetchTxHistory(account) {
  const note    = document.getElementById("txNote");
  const padded  = "0x" + account.slice(2).padStart(64, "0");

  try {
    const [inRes, outRes] = await Promise.all([
      rpcCall("eth_getLogs", [{ address: CONTRACT, topics: [TRANSFER, null,   padded], fromBlock: "0x0", toBlock: "latest" }]),
      rpcCall("eth_getLogs", [{ address: CONTRACT, topics: [TRANSFER, padded, null  ], fromBlock: "0x0", toBlock: "latest" }]),
    ]);

    const inLogs  = inRes.result  || [];
    const outLogs = outRes.result || [];
    const total   = inLogs.length + outLogs.length;

    if (total === 0) {
      note.textContent = "No TC transactions found for this wallet yet.";
      return emptyTx();
    }

    note.textContent = `${total} transaction(s) found on Sepolia.`;

    const buckets = {};

    for (const log of inLogs) {
      const d = await blockDate(log.blockNumber);
      const v = Number(BigInt(log.data) / BigInt(10 ** 18));
      buckets[d] = buckets[d] || { r: 0, s: 0 };
      buckets[d].r += v;
    }
    for (const log of outLogs) {
      const d = await blockDate(log.blockNumber);
      const v = Number(BigInt(log.data) / BigInt(10 ** 18));
      buckets[d] = buckets[d] || { r: 0, s: 0 };
      buckets[d].s += v;
    }

    const dates = Object.keys(buckets).sort();
    return {
      labels:   dates,
      received: dates.map(d => buckets[d].r),
      sent:     dates.map(d => buckets[d].s),
    };
  } catch (err) {
    console.error(err);
    note.textContent = "Could not load transaction history.";
    return emptyTx();
  }
}

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

async function blockDate(hex) {
  if (blockCache[hex]) return blockCache[hex];
  try {
    const res  = await rpcCall("eth_getBlockByNumber", [hex, false]);
    const ts   = parseInt(res.result.timestamp, 16) * 1000;
    const date = new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    blockCache[hex] = date;
    return date;
  } catch { return "Unknown"; }
}

function emptyTx() {
  return { labels: ["No data"], received: [0], sent: [0] };
}

// ─────────────────────────────────────────────────────────────
// COPY ADDRESS
// ─────────────────────────────────────────────────────────────
function copyAddress() {
  navigator.clipboard.writeText(document.getElementById("contractAddr").textContent).then(() => {
    const btn = document.querySelector(".btn-copy");
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy", 2000);
  });
}
