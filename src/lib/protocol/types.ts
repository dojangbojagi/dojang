import type { Address, Hex } from "viem";

export type WalletState = "disconnected" | "connecting" | "connected" | "wrong-network";

export type DojangState =
  | "idle"
  | "checking"
  | "official-verified"
  | "no-official-credential"
  | "invalid"
  | "expired"
  | "revoked"
  | "read-error";

export interface OfficialDojangCredential {
  state: Exclude<DojangState, "idle" | "checking" | "read-error">;
  wallet: Address;
  issuer: Address;
  attestationUid: Hex;
  issuedAt: bigint;
  expirationTime: bigint;
  revocationTime: bigint;
  schemaUid: Hex;
  isValid: boolean;
  isVerified: boolean;
}

export type DemoCredentialState =
  | "disconnected"
  | "unconfigured"
  | "checking"
  | "missing"
  | "active"
  | "expired"
  | "revoked"
  | "read-error";

export interface DemoCredentialRecord {
  wallet: Address;
  commitment: Hex;
  issuer: Address;
  issuedAt: bigint;
  expiresAt: bigint;
  version: bigint;
  revoked: boolean;
}

export type ProofState =
  | "credential-required"
  | "ready-to-prove"
  | "generating"
  | "invalid"
  | "ready-to-submit"
  | "contract-unconfigured";

export interface PublicProofInputs {
  subject: Address;
  commitment: Hex;
  policyId: bigint;
  policyVersion: bigint;
  threshold: bigint;
  credentialVersion: bigint;
  expiresAt: bigint;
  chainId: bigint;
  vault: Address;
}

export type EligibilityPublicInputs = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
];

export interface EligibilityProof {
  proof: Hex;
  publicInputs: EligibilityPublicInputs;
  publicContext: PublicProofInputs;
  createdAt: number;
  localVerification: "verified" | "not-run";
}

export type TransactionState =
  | "idle"
  | "simulating"
  | "awaiting-signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "reverted"
  | "rejected"
  | "rpc-error";

export interface TransactionLifecycle {
  state: TransactionState;
  hash?: Hex;
  explorerUrl?: string;
  error?: string;
}

export type VaultState =
  | "unconfigured"
  | "disconnected"
  | "checking"
  | "locked"
  | "eligible"
  | "access-granted"
  | "previously-granted"
  | "read-error";

export type ProtocolErrorCode =
  | "WALLET_REQUIRED"
  | "WRONG_NETWORK"
  | "CONTRACTS_UNCONFIGURED"
  | "INVALID_CREDENTIAL"
  | "ISSUER_NOT_AUTHORIZED"
  | "CREDENTIAL_VERSION_CHANGED"
  | "CREDENTIAL_REQUIRED"
  | "CREDENTIAL_MISMATCH"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_REVOKED"
  | "INVALID_PROOF"
  | "ALREADY_GRANTED"
  | "TRANSACTION_REJECTED"
  | "INSUFFICIENT_FUNDS"
  | "RPC_ERROR";

export class ProtocolError extends Error {
  readonly code: ProtocolErrorCode;
  readonly cause?: unknown;

  constructor(code: ProtocolErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.cause = cause;
  }
}
