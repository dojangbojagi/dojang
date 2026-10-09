// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EligibilityVerifierAdapter} from "../src/EligibilityVerifierAdapter.sol";
import {HonkVerifier} from "../src/generated/EligibilityHonkVerifier.sol";

interface VmProofFixture {
    function readFile(string calldata path) external view returns (string memory);
    function parseBytes(string calldata value) external pure returns (bytes memory);
}

contract VerifierConformanceTest {
    VmProofFixture private constant vm = VmProofFixture(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testGeneratedVerifierAcceptsNoirProof() public {
        HonkVerifier verifier = new HonkVerifier();
        EligibilityVerifierAdapter adapter = new EligibilityVerifierAdapter(verifier);
        bytes memory proof = _proof();

        require(adapter.verifyProof(proof, _publicInputs()), "generated verifier rejected valid Noir proof");
    }

    function testGeneratedVerifierRejectsChangedPublicInput() public {
        HonkVerifier verifier = new HonkVerifier();
        EligibilityVerifierAdapter adapter = new EligibilityVerifierAdapter(verifier);
        uint256[9] memory inputs = _publicInputs();
        inputs[1] += 1;

        require(!adapter.verifyProof(_proof(), inputs), "generated verifier accepted changed commitment");
    }

    function testGeneratedVerifierRejectsChangedProof() public {
        HonkVerifier verifier = new HonkVerifier();
        EligibilityVerifierAdapter adapter = new EligibilityVerifierAdapter(verifier);
        bytes memory proof = _proof();
        proof[0] = bytes1(uint8(proof[0]) ^ 1);

        require(!adapter.verifyProof(proof, _publicInputs()), "generated verifier accepted changed proof");
    }

    function _proof() private view returns (bytes memory) {
        string memory encoded = vm.readFile("../circuits/testdata/eligibility-proof.hex");
        return vm.parseBytes(string.concat("0x", encoded));
    }

    function _publicInputs() private pure returns (uint256[9] memory inputs) {
        inputs[0] = uint256(uint160(0x1111111111111111111111111111111111111111));
        inputs[1] = uint256(0x22443583840be00779f996bdf2003f4668c4ca10af8a38869aa299cd2853d0f9);
        inputs[2] = 1;
        inputs[3] = 1;
        inputs[4] = 1_000;
        inputs[5] = 1;
        inputs[6] = 4_102_444_800;
        inputs[7] = 91_342;
        inputs[8] = uint256(uint160(0x2222222222222222222222222222222222222222));
    }
}
