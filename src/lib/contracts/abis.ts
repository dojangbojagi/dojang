import { parseAbi } from "viem";

export const dojangScrollAbi = parseAbi([
  "function isVerified(address addr, bytes32 attesterId) view returns (bool)",
  "function getVerifiedAddressAttestationUid(address addr, bytes32 attesterId) view returns (bytes32)",
]);

export const dojangAttesterBookAbi = parseAbi([
  "function getAttester(bytes32 attesterId) view returns (address)",
]);

export const easAbi = [
  {
    type: "function",
    name: "isAttestationValid",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "attestation",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export const credentialRegistryAbi = [
  {
    type: "function",
    name: "recordCredential",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "policyId", type: "uint256" },
      { name: "commitment", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "expectedVersion", type: "uint64" },
    ],
    outputs: [{ name: "version", type: "uint64" }],
  },
  {
    type: "function",
    name: "revokeCredential",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "policyId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getCredential",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "policyId", type: "uint256" },
    ],
    outputs: [
      {
        name: "credential",
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "commitment", type: "bytes32" },
          { name: "issuer", type: "address" },
          { name: "issuedAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
          { name: "version", type: "uint64" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const restrictedVaultAbi = [
  {
    type: "function",
    name: "threshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasAccess",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "enterVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "publicInputs", type: "uint256[9]" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "VaultAccessGranted",
    anonymous: false,
    inputs: [
      { indexed: true, name: "wallet", type: "address" },
      { indexed: true, name: "policyId", type: "uint256" },
      { indexed: false, name: "credentialVersion", type: "uint64" },
      { indexed: false, name: "commitment", type: "bytes32" },
    ],
  },
] as const;
