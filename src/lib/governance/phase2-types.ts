import type { Address, Hex } from "viem";
import type { DemoCredentialRecord } from "@/lib/protocol/types";

export type Phase2ProposalState =
  | "pending"
  | "commit"
  | "reveal"
  | "succeeded"
  | "rejected"
  | "expired"
  | "executed";

export interface Phase2ReputationClaim {
  wallet: Address;
  commitment: Hex;
  issuer: Address;
  issuedAt: bigint;
  expiresAt: bigint;
  credentialVersion: bigint;
  modelVersion: bigint;
  observedFromBlock: bigint;
  observedToBlock: bigint;
  evidenceHash: Hex;
  revoked: boolean;
  active: boolean;
}

export interface Phase2Membership {
  commitment: Hex;
  credentialVersion: bigint;
  expiresAt: bigint;
  registeredAt: bigint;
  reputationThreshold: bigint;
  active: boolean;
}

export interface Phase2Proposal {
  id: bigint;
  proposer: Address;
  contentReference: string;
  createdAt: bigint;
  startAt: bigint;
  commitDeadline: bigint;
  revealDeadline: bigint;
  executionDeadline: bigint;
  proposedMinimumReputation: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  committedVotes: bigint;
  finalized: boolean;
  approved: boolean;
  executed: boolean;
  state: Phase2ProposalState;
  walletCommitted?: boolean;
  walletRevealed?: boolean;
}

export interface Phase2Snapshot {
  paused: boolean;
  commitPeriod: bigint;
  revealPeriod: bigint;
  executionWindow: bigint;
  quorum: bigint;
  minimumReputation: bigint;
  nextProposalId: bigint;
  credential?: DemoCredentialRecord;
  credentialActive: boolean;
  reputation?: Phase2ReputationClaim;
  membership?: Phase2Membership;
  proposal?: Phase2Proposal;
}

export interface Phase2BallotSecret {
  format: "gyevo-dao-phase2-ballot-v1";
  chainId: 4663 | 46630;
  governance: Address;
  voter: Address;
  proposalId: string;
  voteType: 0 | 1 | 2;
  salt: Hex;
  commitment: Hex;
  nullifier: Hex;
}
