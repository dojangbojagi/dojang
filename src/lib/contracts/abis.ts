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

export const lendingPoolAbi = parseAbi([
  "function LENDING_POLICY_ID() view returns (uint256)",
  "function LENDING_POLICY_VERSION() view returns (uint256)",
  "function ELIGIBILITY_THRESHOLD() view returns (uint256)",
  "function MAX_LTV_BPS() view returns (uint256)",
  "function INTEREST_RATE_BPS() view returns (uint256)",
  "function lendingAsset() view returns (address)",
  "function collateralAsset() view returns (address)",
  "function lendingAssetDecimals() view returns (uint8)",
  "function collateralAssetDecimals() view returns (uint8)",
  "function totalSupplierLiquidity() view returns (uint256)",
  "function totalDebt() view returns (uint256)",
  "function supplierBalance(address supplier) view returns (uint256)",
  "function collateralBalance(address borrower) view returns (uint256)",
  "function debtBalance(address borrower) view returns (uint256)",
  "function collateralValue(address borrower) view returns (uint256)",
  "function borrowingCapacity(address borrower) view returns (uint256)",
  "function remainingBorrowCapacity(address borrower) view returns (uint256)",
  "function availableLiquidity() view returns (uint256)",
  "function supply(uint256 amount)",
  "function withdrawSupply(uint256 amount)",
  "function depositCollateral(uint256 amount)",
  "function withdrawCollateral(uint256 amount)",
  "function borrow(uint256 amount, bytes proof, uint256[9] publicInputs)",
  "function repay(uint256 amount)",
  "event LiquiditySupplied(address indexed supplier, uint256 amount, uint256 supplierPosition)",
  "event LiquidityWithdrawn(address indexed supplier, uint256 amount, uint256 supplierPosition)",
  "event CollateralDeposited(address indexed borrower, uint256 amount, uint256 collateralBalance)",
  "event CollateralWithdrawn(address indexed borrower, uint256 amount, uint256 collateralBalance)",
  "event Borrowed(address indexed borrower, uint256 amount, uint256 outstandingDebt, uint64 credentialVersion, bytes32 commitment)",
  "event Repaid(address indexed borrower, uint256 amount, uint256 outstandingDebt)",
]);

export const controlledTokenAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
]);

export const credentialIssuerRoleAbi = parseAbi([
  "function ISSUER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
]);
