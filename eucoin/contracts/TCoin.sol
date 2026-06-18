// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TCoin
 * @dev ERC-20 token with a fixed total supply of 14 TC.
 *      The entire supply is minted to the funding wallet (deployer) at construction.
 */
contract TCoin is ERC20 {
    constructor(address fundingWallet) ERC20("TCoin", "TC") {
        // Mint all 14 tokens (14 * 10^18 wei) to the funding wallet
        _mint(fundingWallet, 14 * 10 ** decimals());
    }
}
