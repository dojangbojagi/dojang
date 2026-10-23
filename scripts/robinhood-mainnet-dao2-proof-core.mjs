import assert from "node:assert/strict";
import { getAddress, isAddress } from "viem";
import { isCredentialWitnessForChain } from "../src/lib/credential/witness.ts";

const ZERO = "0x0000000000000000000000000000000000000000";
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;

/** Validate a real Policy 5 witness against live registry/claim readbacks before proving. */
export function mainnetPolicy5ProofContext({ witness, wallet, credential, claim, activeClaim, threshold, now, governance, chainId }) {
  assert.equal(Number(chainId), 4_663, "Policy 5 proof must target Robinhood Mainnet chain 4663.");
  assert.ok(isAddress(wallet) && isAddress(governance), "Wallet or governance address is invalid.");
  const subject = getAddress(wallet);
  assert.ok(isCredentialWitnessForChain(witness, Number(chainId), "robinhood-demo-credential-v1"), "Expected a Robinhood project credential witness for another chain.");
  assert.equal(witness?.policyId, 5, "DAO Phase 2 requires Policy 5.");
  assert.ok(isAddress(witness.wallet), "Witness wallet is invalid.");
  assert.equal(getAddress(witness.wallet).toLowerCase(), subject.toLowerCase(), "Witness belongs to another wallet.");
  assert.match(witness.commitment ?? "", BYTES32, "Witness commitment must be bytes32.");
  assert.match(witness.salt ?? "", BYTES32, "Witness salt must be bytes32.");
  assert.match(witness.privateValue ?? "", DECIMAL, "Witness private value must be an unsigned integer.");
  assert.ok(BigInt(witness.privateValue) >= BigInt(threshold), "Private reputation score is below the live DAO threshold.");
  assert.equal(getAddress(credential.wallet).toLowerCase(), subject.toLowerCase(), "Credential belongs to another wallet.");
  assert.notEqual(getAddress(credential.issuer), ZERO, "Policy 5 credential is missing.");
  assert.equal(credential.revoked, false, "Policy 5 credential is revoked.");
  assert.ok(BigInt(credential.issuedAt) <= BigInt(now) && BigInt(credential.expiresAt) > BigInt(now), "Policy 5 credential is not currently active.");
  assert.equal(credential.commitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment differs from the active Policy 5 credential.");
  assert.equal(BigInt(witness.expiresAt), BigInt(credential.expiresAt), "Witness expiry differs from the active Policy 5 credential.");
  assert.equal(activeClaim, true, "No active Mainnet reputation claim exists for this wallet.");
  assert.equal(getAddress(claim.wallet).toLowerCase(), subject.toLowerCase(), "Reputation claim belongs to another wallet.");
  assert.notEqual(getAddress(claim.issuer), ZERO, "Reputation claim is missing.");
  assert.equal(claim.revoked, false, "Reputation claim is revoked.");
  assert.equal(claim.commitment.toLowerCase(), witness.commitment.toLowerCase(), "Reputation claim commitment differs from the Policy 5 witness.");
  assert.equal(BigInt(claim.expiresAt), BigInt(credential.expiresAt), "Reputation claim expiry differs from the Policy 5 credential.");
  assert.equal(BigInt(claim.credentialVersion), BigInt(credential.version), "Reputation claim and Policy 5 credential versions differ.");
  assert.equal(BigInt(claim.modelVersion), 1n, "Unsupported Mainnet reputation model version.");
  return {
    subject,
    commitment: credential.commitment,
    policyId: 5n,
    policyVersion: 1n,
    threshold: BigInt(threshold),
    credentialVersion: BigInt(credential.version),
    expiresAt: BigInt(credential.expiresAt),
    chainId: 4_663n,
    vault: getAddress(governance),
  };
}

export function assertMainnetProposalCreationReady({ paused, activeMember, maximumReputation, proposedMinimumReputation }) {
  assert.equal(paused, false, "Governance is paused; activation requires separate authorization.");
  assert.equal(activeMember, true, "Proposer is not an active proof-backed Mainnet member.");
  const proposed = BigInt(proposedMinimumReputation);
  assert.ok(proposed > 0n && proposed <= BigInt(maximumReputation), "Proposed minimum reputation is outside the on-chain allowed range.");
}

export function assertMainnetProposalFinalizationReady({ finalized, now, revealDeadline }) {
  assert.equal(finalized, false, "Proposal is already finalized; refusing duplicate finalization.");
  assert.ok(BigInt(now) >= BigInt(revealDeadline), "Reveal period has not ended on-chain.");
}

export function assertMainnetProposalExecutionReady({ paused, finalized, approved, proposalState }) {
  assert.equal(paused, false, "Governance is paused; activation requires separate authorization.");
  assert.equal(finalized, true, "Proposal must be finalized before execution.");
  assert.equal(approved, true, "Finalized proposal was not approved.");
  assert.equal(Number(proposalState), 4, "Proposal is not currently Succeeded (check deadline and lifecycle state).");
}
