const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying TCoin with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const TCoin = await ethers.getContractFactory("TCoin");
  const token = await TCoin.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("✅ TCoin deployed to:", address);

  const tokenBalance = await token.balanceOf(deployer.address);
  console.log("Funding wallet TC balance:", ethers.formatUnits(tokenBalance, 18), "TC");
  console.log("Total supply:", ethers.formatUnits(await token.totalSupply(), 18), "TC");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
