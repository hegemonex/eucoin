// ── Config ──────────────────────────────────────────────────
const CONTRACT  = "0x6aE4DAB1f28630d2D56740cF5D8da78d5de01DBf";
const SEPOLIA   = "0xaa36a7";
const RPC_URL   = "https://eth-sepolia.g.alchemy.com/v2/17uczrYjtGkO-dt7QwL5e";
const TRANSFER  = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

let currentAccount = null;
let refreshTimer   = null;
let pieInst  = null;
let lineInst = null;
const blockCache = {};

// Safe element getter — never throws, never alerts
function el(id) {
  return document.getElementById(id) || null;
}

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function setDisplay(id, value) {
  const node = el(id);
  if (node) node.style.display = value;
}

// ─────────────────────────────────────────────────────────────
// CONNECT
// ─────────────────────────────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) {
    console.warn("MetaMask not detected");
    return;
  }

  setText("connectBtn", "Connecting...");

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    await switchToSepolia();
    await onConnect(accounts[0]);
    window.ethereum.on("accountsChanged", (a) => a.length ? onConnect(a[0]) : onDisconnect());
    window.ethereum.on("chainChanged", () => location.reload());
  } catch (e) {
    console.error("Connection failed:", e.message || e);
    setText("connectBtn", "Connect Wallet");
    setDisplay("connectBtn", "inline-block");
  }
}

// ─────────────────────────────────────────────────────────────
// SWITCH WALLET
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
  } catch (err) {
    console.error("Switch wallet failed:", err.message || err);
  }
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
  currentAccount = null;
  localStorage.removeItem("tcoin_account");
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  setText("connectBtn", "Connect Wallet");
  setDisplay("connectBtn", "inline-block");
  setDisplay("profilePill", "none");
  setDisplay("walletSection", "none");
  if (pieInst)  { pieInst.destroy();  pieInst  = null; }
  if (lineInst) { lineInst.destroy(); lineInst = null; }
  // Rebuild demo charts
  buildPie(14, 0.05);
  buildDemoLine();
}

// ─────────────────────────────────────────────────────────────
// ON CONNECT
// ─────────────────────────────────────────────────────────────
async function onConnect(account) {
  try {
    currentAccount = account;
    // Remember the account across page refreshes
    localStorage.setItem("tcoin_account", account);
    const short    = account.slice(0, 6) + "..." + account.slice(-4);
    const initials = account.slice(2, 4).toUpperCase();

    // Nav pill
    setDisplay("connectBtn", "none");
    setDisplay("profilePill", "flex");
    setText("profileAvatar", initials);
    setText("profileAddr",   short);
    setText("ddAvatar",      initials);
    setText("ddAddr",        short);

    // Balances
    const tc  = await getTCBalance(account);
    const eth = await getETHBalance(account);

    setText("ddBal",  tc + " TC");
    setText("wcAddr", short);
    setText("wcBal",  tc + " TC");
    setText("wcEth",  eth + " ETH");

    setDisplay("walletSection", "block");

    // Rebuild charts with real data
    buildPie(parseFloat(tc), parseFloat(eth));
    await buildLine(account);

    // Scroll to wallet card
    const ws = el("walletSection");
    if (ws) ws.scrollIntoView({ behavior: "smooth" });

    // Auto-refresh every 15 seconds
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshBalances(), 15000);

  } catch (e) {
    console.error("onConnect error:", e.message || e);
  }
}

// ─────────────────────────────────────────────────────────────
// REFRESH BALANCES
// ─────────────────────────────────────────────────────────────
async function refreshBalances() {
  if (!currentAccount) return;
  try {
    const btn = el("refreshBtn");
    if (btn) btn.textContent = "↻ Refreshing...";

    const tc  = await getTCBalance(currentAccount);
    const eth = await getETHBalance(currentAccount);

    setText("wcBal",  tc + " TC");
    setText("wcEth",  eth + " ETH");
    setText("ddBal",  tc + " TC");

    // Rebuild pie with updated values
    buildPie(parseFloat(tc), parseFloat(eth));

    // Rebuild line chart with latest transactions
    await buildLine(currentAccount);

    if (btn) btn.textContent = "↻ Refresh";
  } catch (e) {
    console.error("Refresh failed:", e.message || e);
    const btn = el("refreshBtn");
    if (btn) btn.textContent = "↻ Refresh";
  }
}

// ─────────────────────────────────────────────────────────────
// DROPDOWN
// ─────────────────────────────────────────────────────────────
function toggleDropdown(e) {
  if (e) e.stopPropagation();
  const dd = el("profileDropdown");
  if (dd) dd.classList.toggle("open");
}

function closeDropdown() {
  const dd = el("profileDropdown");
  if (dd) dd.classList.remove("open");
}

// ─────────────────────────────────────────────────────────────
// SWITCH TO SEPOLIA
// ─────────────────────────────────────────────────────────────
async function switchToSepolia() {
  try {
    const chain = await window.ethereum.request({ method: "eth_chainId" });
    if (chain !== SEPOLIA) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA }],
      });
    }
  } catch (e) {
    console.error("Could not switch to Sepolia:", e.message || e);
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
    const raw   = BigInt(result);
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
// PIE CHART
// ─────────────────────────────────────────────────────────────
function buildPie(tc, eth) {
  if (pieInst) { pieInst.destroy(); pieInst = null; }

  const canvas = el("pieChart");
  if (!canvas) return;

  const labels = [];
  const data   = [];
  const colors = ["#7c3aed", "#06b6d4"];

  if (tc  > 0) { labels.push("TCoin (TC)");  data.push(tc);  }
  if (eth > 0) { labels.push("Sepolia ETH"); data.push(eth); }
  if (!data.length) { labels.push("No assets"); data.push(1); colors[0] = "#2a2a3a"; }

  const usedColors = colors.slice(0, labels.length);

  pieInst = new Chart(canvas.getContext("2d"), {
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
      responsive: true,
      maintainAspectRatio: false,
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
  });

  const legend = el("pieLegend");
  if (legend) {
    legend.innerHTML = labels
      .map((l, i) => `
        <div class="leg-item">
          <span class="leg-dot" style="background:${usedColors[i]}"></span>
          <span>${l}: ${data[i]}</span>
        </div>`)
      .join("");
  }
}

// ─────────────────────────────────────────────────────────────
// LINE CHART — real data
// ─────────────────────────────────────────────────────────────
async function buildLine(account) {
  if (lineInst) { lineInst.destroy(); lineInst = null; }

  const canvas = el("lineChart");
  if (!canvas) return;

  const { labels, received, sent } = await fetchTxHistory(account);

  lineInst = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "TC Received",
          data: received,
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124,58,237,0.15)",
          fill: true, tension: 0.4,
          pointRadius: 5, pointBackgroundColor: "#7c3aed", borderWidth: 2,
        },
        {
          label: "TC Sent",
          data: sent,
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6,182,212,0.1)",
          fill: true, tension: 0.4,
          pointRadius: 5, pointBackgroundColor: "#06b6d4", borderWidth: 2,
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
  });
}

// ─────────────────────────────────────────────────────────────
// LINE CHART — demo data (shown before connect)
// ─────────────────────────────────────────────────────────────
function buildDemoLine() {
  if (lineInst) { lineInst.destroy(); lineInst = null; }

  const canvas = el("lineChart");
  if (!canvas) return;

  const note = el("txNote");
  if (note) note.textContent = "Connect your wallet to see real transaction history.";

  lineInst = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: ["01 Jan 2025", "15 Jan 2025", "01 Feb 2025", "15 Feb 2025", "01 Mar 2025", "15 Mar 2025"],
      datasets: [
        {
          label: "TC Received",
          data: [14, 14, 14, 14, 14, 14],
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124,58,237,0.15)",
          fill: true, tension: 0.4,
          pointRadius: 5, pointBackgroundColor: "#7c3aed", borderWidth: 2,
        },
        {
          label: "TC Sent",
          data: [0, 0, 0, 0, 0, 0],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6,182,212,0.1)",
          fill: true, tension: 0.4,
          pointRadius: 5, pointBackgroundColor: "#06b6d4", borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#e2e2f0", font: { size: 12 } } },
      },
      scales: {
        x: { ticks: { color: "#8888aa" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { beginAtZero: true, ticks: { color: "#8888aa" }, grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// FETCH TX HISTORY
// ─────────────────────────────────────────────────────────────
async function fetchTxHistory(account) {
  const note   = el("txNote");
  const padded = "0x" + account.slice(2).padStart(64, "0");

  try {
    const [inRes, outRes] = await Promise.all([
      rpcCall("eth_getLogs", [{ address: CONTRACT, topics: [TRANSFER, null, padded],   fromBlock: "0x0", toBlock: "latest" }]),
      rpcCall("eth_getLogs", [{ address: CONTRACT, topics: [TRANSFER, padded, null],   fromBlock: "0x0", toBlock: "latest" }]),
    ]);

    const inLogs  = inRes.result  || [];
    const outLogs = outRes.result || [];
    const total   = inLogs.length + outLogs.length;

    if (total === 0) {
      if (note) note.textContent = "No TC transactions found for this wallet yet.";
      return { labels: ["No data"], received: [0], sent: [0] };
    }

    if (note) note.textContent = `${total} transaction(s) found on Sepolia.`;

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
    console.error("TX history error:", err);
    if (note) note.textContent = "Could not load transaction history.";
    return { labels: ["No data"], received: [0], sent: [0] };
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

// ─────────────────────────────────────────────────────────────
// COPY ADDRESS
// ─────────────────────────────────────────────────────────────
function copyAddress() {
  const addr = el("contractAddr");
  if (!addr) return;
  navigator.clipboard.writeText(addr.textContent).then(() => {
    const btn = document.querySelector(".btn-copy");
    if (btn) {
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 2000);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  document.addEventListener("click", closeDropdown);

  const connectBtn = el("connectBtn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  const profilePill = el("profilePill");
  if (profilePill) profilePill.addEventListener("click", toggleDropdown);

  const switchBtn = document.querySelector(".dd-btn:not(.dd-logout)");
  if (switchBtn) switchBtn.addEventListener("click", switchWallet);

  const logoutBtn = document.querySelector(".dd-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", disconnectWallet);

  const copyBtn = document.querySelector(".btn-copy");
  if (copyBtn) copyBtn.addEventListener("click", copyAddress);

  // Show charts with demo data on load
  setDisplay("chartsSection", "block");
  buildPie(14, 0.05);
  buildDemoLine();

  // Auto-reconnect if MetaMask already has a connected account
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        await onConnect(accounts[0]);
      } else {
        // Fallback: restore from localStorage
        const saved = localStorage.getItem("tcoin_account");
        if (saved) {
          await onConnect(saved);
        }
      }
    } catch (e) {
      console.warn("Auto-reconnect failed:", e.message);
      // Still try localStorage
      const saved = localStorage.getItem("tcoin_account");
      if (saved) {
        await onConnect(saved);
      }
    }

    window.ethereum.on("accountsChanged", (a) => {
      if (a.length > 0) onConnect(a[0]);
      else onDisconnect();
    });
    window.ethereum.on("chainChanged", () => location.reload());
  }
});

