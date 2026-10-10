// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Official external GIWA Sepolia Dojang/EAS configuration from the GIWA docs.
library GIWASepoliaDojang {
    address internal constant SCROLL = 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9;
    address internal constant ATTESTER_BOOK = 0xDA282E89244424E297Ce8e78089B54D043FB28B6;
    address internal constant EAS = 0x4200000000000000000000000000000000000021;
    bytes32 internal constant UPBIT_KOREA_ATTESTER_ID =
        0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034;
    bytes32 internal constant VERIFIED_ADDRESS_SCHEMA_UID =
        0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08;
}
