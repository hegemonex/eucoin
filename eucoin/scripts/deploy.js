const { ethers } = require("hardhat");

async function main() {
  // The first Hardhat test account acts as the funding wallet
  const [fundingWallet] = await ethers.getSigners();

  console.log("Deploying EUcoin...");
  console.log("Funding wallet:", fundingWallet.address);

  const EUcoin = await ethers.getContractFactory("EUcoin");
  const token = await EUcoin.deploy(fundingWallet.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("EUcoin deployed to:", address);

  // Confirm the funding wallet received all 14 tokens
  const balance = await token.balanceOf(fundingWallet.address);
  console.log("Funding wallet balance:", ethers.formatUnits(balance, 18), "EUC");

  const totalSupply = await token.totalSupply();
  console.log("Total supply:         ", ethers.formatUnits(totalSupply, 18), "EUC");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
