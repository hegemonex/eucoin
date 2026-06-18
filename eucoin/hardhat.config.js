require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/17uczrYjtGkO-dt7QwL5e",
      accounts: ["cc926878462003be72bc6af23673c10d33c3efa761da23d46254adc1c5f538cb"],
    },
  },
};
