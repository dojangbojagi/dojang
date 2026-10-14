// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Capped, role-minted synthetic asset for a controlled Robinhood Mainnet demonstration.
/// @dev Never represents a real-world asset or redeemable claim. Not suitable as a production token.
contract RobinhoodMainnetDemoToken is ERC20, AccessControl {
    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes4 public constant CONTROLLED_DEMO_ASSET_MARKER = bytes4(keccak256("ROBINHOOD_MAINNET_CONTROLLED_DEMO_ASSET_V1"));

    uint8 private immutable tokenDecimals;
    uint256 public immutable mintCap;

    error UnsupportedChain();
    error InvalidRoleAddress();
    error ZeroMintCap();
    error UnsupportedDecimals(uint8 decimals_);
    error SupplyCapExceeded(uint256 requestedSupply, uint256 cap);
    error ZeroAmount();

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 mintCap_, address admin_, address minter_)
        ERC20(name_, symbol_)
    {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert UnsupportedChain();
        if (admin_ == address(0) || minter_ == address(0) || admin_ == minter_) revert InvalidRoleAddress();
        if (mintCap_ == 0) revert ZeroMintCap();
        if (decimals_ > 18) revert UnsupportedDecimals(decimals_);
        tokenDecimals = decimals_;
        mintCap = mintCap_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, minter_);
    }

    function decimals() public view override returns (uint8) { return tokenDecimals; }
    function controlledDemoAssetMarker() external pure returns (bytes4) { return CONTROLLED_DEMO_ASSET_MARKER; }
    function demoOnly() external pure returns (bool) { return true; }

    function mint(address account, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (account == address(0) || amount == 0) revert ZeroAmount();
        uint256 requestedSupply = totalSupply() + amount;
        if (requestedSupply > mintCap) revert SupplyCapExceeded(requestedSupply, mintCap);
        _mint(account, amount);
    }
}
