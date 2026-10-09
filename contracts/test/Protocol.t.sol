// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {RestrictedVault} from "../src/RestrictedVault.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";

/// @dev This fixture tests the vault's verifier boundary only. It is not a ZK verifier and must
/// never be deployed or treated as cryptographic proof evidence.
contract TestOnlyVerifierFixture is IEligibilityVerifier {
    bytes private constant ACCEPTED_FIXTURE = hex"01";

    function verifyProof(bytes calldata proof, uint256[9] calldata) external pure returns (bool) {
        return keccak256(proof) == keccak256(ACCEPTED_FIXTURE);
    }
}

interface Vm {
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function chainId(uint256 newChainId) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

contract ProtocolTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ISSUER = address(0x1001);
    address private constant SUBJECT = address(0x2002);
    address private constant OTHER = address(0x3003);
    uint256 private constant POLICY_ID = 1;
    uint256 private constant THRESHOLD = 1_000;
    bytes32 private constant COMMITMENT = keccak256("issuer-controlled commitment fixture");

    DemoCredentialRegistry private registry;
    TestOnlyVerifierFixture private verifier;
    RestrictedVault private vault;
    uint64 private expiry;

    function setUp() public {
        registry = new DemoCredentialRegistry();
        verifier = new TestOnlyVerifierFixture();
        vault = new RestrictedVault(registry, verifier);
        registry.grantRole(registry.ISSUER_ROLE(), ISSUER);
        expiry = uint64(block.timestamp + 30 days);
        vm.prank(ISSUER);
        registry.recordCredential(SUBJECT, POLICY_ID, COMMITMENT, expiry, 1);
    }

    function testAuthorizedIssuerCanCommitCredential() public view {
        DemoCredentialRegistry.Credential memory credential = registry.getCredential(SUBJECT, POLICY_ID);
        require(credential.issuer == ISSUER, "issuer not recorded");
        require(credential.commitment == COMMITMENT, "commitment not recorded");
        require(credential.version == 1, "version not initialized");
    }

    function testRegistryRejectsWrongChain() public {
        vm.chainId(1);
        vm.expectRevert(DemoCredentialRegistry.UnsupportedChain.selector);
        new DemoCredentialRegistry();
        vm.chainId(91342);
    }

    function testVaultRejectsWrongChain() public {
        vm.chainId(1);
        vm.expectRevert(RestrictedVault.UnsupportedChain.selector);
        new RestrictedVault(registry, verifier);
        vm.chainId(91342);
    }

    function testUnauthorizedIssuerCannotCommit() public {
        vm.prank(OTHER);
        vm.expectRevert();
        registry.recordCredential(SUBJECT, POLICY_ID, COMMITMENT, expiry, 1);
    }

    function testIssuerCannotCommitAgainstStaleVersion() public {
        vm.prank(ISSUER);
        vm.expectRevert(abi.encodeWithSelector(
            DemoCredentialRegistry.UnexpectedCredentialVersion.selector,
            uint64(3),
            uint64(2)
        ));
        registry.recordCredential(SUBJECT, POLICY_ID, COMMITMENT, expiry, 3);
    }

    function testIssuerCanRevokeAndVaultRejectsCredential() public {
        vm.prank(ISSUER);
        registry.revokeCredential(SUBJECT, POLICY_ID);
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.CredentialRevoked.selector);
        vault.enterVault(hex"01", _publicInputs(SUBJECT));
    }

    function testUnauthorizedAccountCannotRevoke() public {
        vm.prank(OTHER);
        vm.expectRevert(DemoCredentialRegistry.NotCredentialIssuer.selector);
        registry.revokeCredential(SUBJECT, POLICY_ID);
    }

    function testExpiredCredentialCannotEnter() public {
        vm.warp(uint256(expiry) + 1);
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.CredentialExpired.selector);
        vault.enterVault(hex"01", _publicInputs(SUBJECT));
    }

    function testWalletWithoutCredentialCannotEnter() public {
        vm.prank(OTHER);
        vm.expectRevert(RestrictedVault.MissingCredential.selector);
        vault.enterVault(hex"01", _publicInputs(OTHER));
    }

    function testInvalidFixtureProofCannotEnter() public {
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.InvalidProof.selector);
        vault.enterVault(hex"02", _publicInputs(SUBJECT));
    }

    function testMismatchedSubjectIsRejected() public {
        vm.prank(ISSUER);
        registry.recordCredential(OTHER, POLICY_ID, COMMITMENT, expiry, 1);
        uint256[9] memory inputs = _publicInputs(OTHER);
        inputs[0] = uint256(uint160(SUBJECT));
        vm.prank(OTHER);
        vm.expectRevert(RestrictedVault.WrongSubject.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongPublicPolicyIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[2] = 2;
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongPolicy.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongPolicyVersionIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[3] = 2;
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongPolicyVersion.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongThresholdIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[4] = THRESHOLD - 1;
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongThreshold.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongCredentialVersionIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[5] = 2;
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongCredentialVersion.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongExpiryIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[6] = uint256(expiry) - 1;
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongExpiry.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongCommitmentIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[1] = uint256(keccak256("different commitment"));
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongCommitment.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongChainBindingIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[7] = block.chainid + 1;
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongChain.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testWrongVaultBindingIsRejected() public {
        uint256[9] memory inputs = _publicInputs(SUBJECT);
        inputs[8] = uint256(uint160(address(this)));
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.WrongVault.selector);
        vault.enterVault(hex"01", inputs);
    }

    function testValidVerifierResultChangesAccessState() public {
        vm.prank(SUBJECT);
        vault.enterVault(hex"01", _publicInputs(SUBJECT));
        require(vault.hasAccess(SUBJECT), "access state not set");
    }

    function testDuplicateEntryIsRejected() public {
        vm.prank(SUBJECT);
        vault.enterVault(hex"01", _publicInputs(SUBJECT));
        vm.prank(SUBJECT);
        vm.expectRevert(RestrictedVault.AlreadyGranted.selector);
        vault.enterVault(hex"01", _publicInputs(SUBJECT));
    }

    function _publicInputs(address subject) private view returns (uint256[9] memory inputs) {
        inputs[0] = uint256(uint160(subject));
        inputs[1] = uint256(COMMITMENT);
        inputs[2] = POLICY_ID;
        inputs[3] = 1;
        inputs[4] = THRESHOLD;
        inputs[5] = 1;
        inputs[6] = expiry;
        inputs[7] = block.chainid;
        inputs[8] = uint256(uint160(address(vault)));
    }
}
