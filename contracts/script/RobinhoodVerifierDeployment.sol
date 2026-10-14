// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EligibilityVerifierAdapter} from "../src/EligibilityVerifierAdapter.sol";
import {HonkVerifier} from "../src/generated/EligibilityHonkVerifier.sol";

interface RobinhoodVerifierVm {
    function getCode(string calldata artifactPath) external view returns (bytes memory creationCode);
    function readFile(string calldata path) external view returns (string memory data);
    function parseJsonString(string calldata json, string calldata key) external pure returns (string memory value);
}

/// @dev Deployment helper for the generated verifier's two external Solidity library links.
///      Offsets are guarded against the generated artifact before any HonkVerifier CREATE.
library RobinhoodVerifierDeployment {
    RobinhoodVerifierVm private constant vm =
        RobinhoodVerifierVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error ArtifactLayoutChanged();
    error ArtifactLinkMismatch(uint256 libraryNameHash, uint256 matches);
    error InvalidArtifactHex(uint256 index, uint8 highOrLow);
    error DeploymentFailed();

    struct Addresses {
        address transcriptLibrary;
        address relationsLibrary;
        address honkVerifier;
        address verifierAdapter;
    }

    function deploy() internal returns (Addresses memory deployed) {
        return _deploy("out/EligibilityHonkVerifier.sol/HonkVerifier.json");
    }

    /// @dev Robinhood Mainnet has an isolated Cancun build output so its verifier bytecode
    ///      cannot accidentally be sourced from the historical Prague/Testnet artifact.
    function deployMainnetDemo() internal returns (Addresses memory deployed) {
        return _deploy("out-mainnet/EligibilityHonkVerifier.sol/HonkVerifier.json");
    }

    function _deploy(string memory verifierArtifactPath) private returns (Addresses memory deployed) {
        deployed.transcriptLibrary = _create(
            vm.getCode("src/generated/EligibilityHonkVerifier.sol:ZKTranscriptLib")
        );
        deployed.relationsLibrary = _create(
            vm.getCode("src/generated/EligibilityHonkVerifier.sol:RelationsLib")
        );

        string memory artifact = vm.readFile(verifierArtifactPath);
        bytes memory linkedObject = _stripHexPrefix(bytes(vm.parseJsonString(artifact, ".bytecode.object")));
        _replaceLink(linkedObject, "ZKTranscriptLib", deployed.transcriptLibrary);
        _replaceLink(linkedObject, "RelationsLib", deployed.relationsLibrary);
        if (_contains(linkedObject, "__$")) revert ArtifactLayoutChanged();
        bytes memory verifierCode = _decodeHex(linkedObject);
        deployed.honkVerifier = _create(verifierCode);
        deployed.verifierAdapter =
            address(new EligibilityVerifierAdapter(HonkVerifier(deployed.honkVerifier)));
    }

    function _create(bytes memory creationCode) private returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        if (deployed == address(0)) revert DeploymentFailed();
    }

    function _replaceLink(bytes memory object, string memory libraryName, address libraryAddress) private pure {
        bytes memory label = bytes(string.concat(
            "__$",
            _first34Hex(keccak256(bytes(string.concat("src/generated/EligibilityHonkVerifier.sol:", libraryName)))),
            "$__"
        ));
        bytes memory replacement = bytes(_addressHex(libraryAddress));
        uint256 foundAt = type(uint256).max;
        uint256 matches;
        if (object.length < label.length) revert ArtifactLayoutChanged();
        for (uint256 i; i <= object.length - label.length; ++i) {
            bool matchesLabel = true;
            for (uint256 j; j < label.length; ++j) {
                if (object[i + j] != label[j]) {
                    matchesLabel = false;
                    break;
                }
            }
            if (matchesLabel) {
                foundAt = i;
                ++matches;
            }
        }
        if (matches != 1 || replacement.length != label.length) {
            revert ArtifactLinkMismatch(uint256(keccak256(bytes(libraryName))), matches);
        }
        for (uint256 j; j < label.length; ++j) object[foundAt + j] = replacement[j];
    }

    function _decodeHex(bytes memory value) private pure returns (bytes memory decoded) {
        if (value.length == 0 || value.length % 2 != 0) revert ArtifactLayoutChanged();
        decoded = new bytes(value.length / 2);
        for (uint256 i; i < decoded.length; ++i) {
            uint8 high = _fromHex(uint8(value[i * 2]), i * 2);
            uint8 low = _fromHex(uint8(value[i * 2 + 1]), i * 2 + 1);
            decoded[i] = bytes1((high << 4) | low);
        }
    }

    function _stripHexPrefix(bytes memory value) private pure returns (bytes memory stripped) {
        if (value.length < 2 || value[0] != "0" || (value[1] != "x" && value[1] != "X")) return value;
        stripped = new bytes(value.length - 2);
        for (uint256 i; i < stripped.length; ++i) stripped[i] = value[i + 2];
    }

    function _fromHex(uint8 character, uint256 index) private pure returns (uint8) {
        if (character >= 48 && character <= 57) return character - 48;
        if (character >= 97 && character <= 102) return character - 87;
        if (character >= 65 && character <= 70) return character - 55;
        revert InvalidArtifactHex(index, character);
    }

    function _first34Hex(bytes32 value) private pure returns (string memory result) {
        bytes memory digits = new bytes(34);
        bytes16 alphabet = "0123456789abcdef";
        for (uint256 i; i < 17; ++i) {
            uint8 current = uint8(value[i]);
            digits[i * 2] = alphabet[current >> 4];
            digits[i * 2 + 1] = alphabet[current & 0x0f];
        }
        result = string(digits);
    }

    function _addressHex(address value) private pure returns (string memory result) {
        bytes memory digits = new bytes(40);
        bytes16 alphabet = "0123456789abcdef";
        bytes20 encoded = bytes20(value);
        for (uint256 i; i < 20; ++i) {
            uint8 current = uint8(encoded[i]);
            digits[i * 2] = alphabet[current >> 4];
            digits[i * 2 + 1] = alphabet[current & 0x0f];
        }
        result = string(digits);
    }

    function _contains(bytes memory data, string memory text) private pure returns (bool) {
        bytes memory needle = bytes(text);
        if (data.length < needle.length) return false;
        for (uint256 i; i <= data.length - needle.length; ++i) {
            bool found = true;
            for (uint256 j; j < needle.length; ++j) {
                if (data[i + j] != needle[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}
