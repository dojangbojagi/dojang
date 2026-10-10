// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IDojangScroll {
    function isVerified(address wallet, bytes32 attesterId) external view returns (bool);
    function getVerifiedAddressAttestationUid(address wallet, bytes32 attesterId)
        external
        view
        returns (bytes32);
}

interface IDojangAttesterBook {
    function getAttester(bytes32 attesterId) external view returns (address);
}

interface IEASDojang {
    struct Attestation {
        bytes32 uid;
        bytes32 schema;
        uint64 time;
        uint64 expirationTime;
        uint64 revocationTime;
        bytes32 refUID;
        address recipient;
        address attester;
        bool revocable;
        bytes data;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory);
    function isAttestationValid(bytes32 uid) external view returns (bool);
}
