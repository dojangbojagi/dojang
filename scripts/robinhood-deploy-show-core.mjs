import assert from "node:assert/strict";

const EXPECTED_GOVERNANCE_CONSTRUCTOR = [3600n, 2n, 604800n, 0n];
const EXPECTED_PROPOSAL_ONE_VALIDITY = 3600n;
const EXECUTED_PROPOSAL_STATE = 6n;

/**
 * Validate immutable governance deployment parameters separately from the mutable
 * minimum validity value, which Proposal #1 legitimately changed after deployment.
 */
export function validateGovernanceReadback({
  constructorArguments,
  votingPeriod,
  quorum,
  executionWindow,
  minimumRemainingValidity,
  nextProposalId,
  proposalOne,
  proposalOneState,
}) {
  assert.ok(Array.isArray(constructorArguments) && constructorArguments.length === 6,
    "Governance deployment artifact is missing constructor arguments");

  const constructorValues = constructorArguments.slice(2).map((value) => BigInt(value));
  assert.deepEqual(constructorValues, EXPECTED_GOVERNANCE_CONSTRUCTOR,
    "Governance constructor parameters do not match the approved deployment values");
  assert.deepEqual([votingPeriod, quorum, executionWindow], EXPECTED_GOVERNANCE_CONSTRUCTOR.slice(0, 3),
    "Governance immutable settings do not match approved deployment values");
  assert.ok(nextProposalId >= 1n, "Governance next proposal ID is invalid");

  const initialMinimumRemainingValidity = constructorValues[3];
  if (nextProposalId === 1n) {
    assert.equal(minimumRemainingValidity, initialMinimumRemainingValidity,
      "Governance minimum validity changed before any proposal was created");
    return "constructor settings confirmed; no proposals exist; initial minimum validity is unchanged";
  }

  assert.ok(proposalOne, "Proposal #1 is missing despite an incremented next proposal ID");
  const proposalOneIsExecutedState = proposalOneState !== undefined
    && BigInt(proposalOneState) === EXECUTED_PROPOSAL_STATE;
  assert.equal(proposalOne.executed, proposalOneIsExecutedState,
    "Proposal #1 executed flag and lifecycle state disagree");

  if (proposalOne.executed) {
    assert.equal(proposalOne.finalized, true, "Executed Proposal #1 is not finalized");
    assert.equal(proposalOne.approved, true, "Executed Proposal #1 was not approved");
    assert.equal(proposalOne.proposedMinimumRemainingValidity, EXPECTED_PROPOSAL_ONE_VALIDITY,
      "Executed Proposal #1 does not contain the approved validity value");
    assert.equal(minimumRemainingValidity, EXPECTED_PROPOSAL_ONE_VALIDITY,
      "Current minimum validity does not match executed Proposal #1");
    return "constructor settings confirmed; Proposal #1 is finalized, approved and executed at 3600 seconds";
  }

  assert.equal(minimumRemainingValidity, initialMinimumRemainingValidity,
    "Governance minimum validity changed before Proposal #1 execution");
  return "constructor settings confirmed; Proposal #1 has not executed; initial minimum validity is unchanged";
}
