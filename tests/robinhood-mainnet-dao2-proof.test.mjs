import { describe, expect, test } from "bun:test";
import {
  assertMainnetProposalCreationReady, assertMainnetProposalExecutionReady,
  assertMainnetProposalFinalizationReady, mainnetPolicy5ProofContext,
} from "../scripts/robinhood-mainnet-dao2-proof-core.mjs";

const wallet = "0xdb354254bf1e0374963600811d1ff5643a56a367";
const governance = "0x0d543953a62a932ca687b160a59b8950af52c252";
const issuer = "0xc6e130e111230d6cfa7ecd6bad283259687ecc49";
const commitment = `0x${"ab".repeat(32)}`;
const witness = {
  format: "robinhood-demo-credential-v1", wallet, policyId: 5,
  commitment, privateValue: "4", salt: `0x${"cd".repeat(32)}`, expiresAt: 2_000,
};
const credential = { wallet, commitment, issuer, issuedAt: 900n, expiresAt: 2_000n, version: 2n, revoked: false };
const claim = { wallet, commitment, issuer, expiresAt: 2_000n, credentialVersion: 2n, modelVersion: 1n, revoked: false };
const valid = () => mainnetPolicy5ProofContext({
  witness, wallet, credential, claim, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 4_663,
});

describe("Robinhood Mainnet DAO Phase 2 proof binding", () => {
  test("builds a Policy 5 proof context bound to the real wallet, DAO, chain, and active record", () => {
    expect(valid()).toEqual({
      subject: "0xdB354254bF1E0374963600811D1fF5643a56A367", commitment,
      policyId: 5n, policyVersion: 1n, threshold: 3n, credentialVersion: 2n,
      expiresAt: 2_000n, chainId: 4_663n,
      vault: "0x0D543953A62a932Ca687b160A59B8950af52C252",
    });
  });

  test("rejects Testnet and unknown chain contexts", () => {
    expect(() => mainnetPolicy5ProofContext({ witness, wallet, credential, claim, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 46_630 })).toThrow("chain 4663");
  });

  test("rejects a witness for a different wallet or policy", () => {
    expect(() => mainnetPolicy5ProofContext({ witness: { ...witness, wallet: governance }, wallet, credential, claim, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 4_663 })).toThrow("another wallet");
    expect(() => mainnetPolicy5ProofContext({ witness: { ...witness, policyId: 3 }, wallet, credential, claim, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 4_663 })).toThrow("Policy 5");
  });

  test("rejects stale, revoked, or mismatched credentials and claims", () => {
    expect(() => mainnetPolicy5ProofContext({ witness, wallet, credential: { ...credential, expiresAt: 999n }, claim, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 4_663 })).toThrow("not currently active");
    expect(() => mainnetPolicy5ProofContext({ witness, wallet, credential, claim: { ...claim, credentialVersion: 1n }, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 4_663 })).toThrow("versions differ");
    expect(() => mainnetPolicy5ProofContext({ witness, wallet, credential, claim, activeClaim: false, threshold: 3n, now: 1_000n, governance, chainId: 4_663 })).toThrow("No active Mainnet reputation claim");
  });

  test("rejects reputation below the live governance threshold", () => {
    expect(() => mainnetPolicy5ProofContext({ witness: { ...witness, privateValue: "2" }, wallet, credential, claim, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 4_663 })).toThrow("below the live DAO threshold");
  });

  test("rejects claims made under an unsupported score model", () => {
    expect(() => mainnetPolicy5ProofContext({ witness, wallet, credential, claim: { ...claim, modelVersion: 2n }, activeClaim: true, threshold: 3n, now: 1_000n, governance, chainId: 4_663 })).toThrow("Unsupported Mainnet reputation model");
  });

  test("proposal creation requires an active member, active governance, and on-chain parameter bounds", () => {
    expect(() => assertMainnetProposalCreationReady({ paused: true, activeMember: true, maximumReputation: 100n, proposedMinimumReputation: 3n })).toThrow("Governance is paused");
    expect(() => assertMainnetProposalCreationReady({ paused: false, activeMember: false, maximumReputation: 100n, proposedMinimumReputation: 3n })).toThrow("active proof-backed");
    expect(() => assertMainnetProposalCreationReady({ paused: false, activeMember: true, maximumReputation: 100n, proposedMinimumReputation: 101n })).toThrow("on-chain allowed range");
    expect(assertMainnetProposalCreationReady({ paused: false, activeMember: true, maximumReputation: 100n, proposedMinimumReputation: 3n })).toBeUndefined();
  });

  test("proposal finalization and execution enforce live deadlines and lifecycle state", () => {
    expect(() => assertMainnetProposalFinalizationReady({ finalized: false, now: 7_259n, revealDeadline: 7_260n })).toThrow("Reveal period has not ended");
    expect(assertMainnetProposalFinalizationReady({ finalized: false, now: 7_260n, revealDeadline: 7_260n })).toBeUndefined();
    expect(() => assertMainnetProposalExecutionReady({ paused: true, finalized: true, approved: true, proposalState: 4 })).toThrow("Governance is paused");
    expect(() => assertMainnetProposalExecutionReady({ paused: false, finalized: false, approved: true, proposalState: 4 })).toThrow("must be finalized");
    expect(() => assertMainnetProposalExecutionReady({ paused: false, finalized: true, approved: false, proposalState: 5 })).toThrow("not approved");
    expect(() => assertMainnetProposalExecutionReady({ paused: false, finalized: true, approved: true, proposalState: 6 })).toThrow("not currently Succeeded");
    expect(assertMainnetProposalExecutionReady({ paused: false, finalized: true, approved: true, proposalState: 4 })).toBeUndefined();
  });
});
