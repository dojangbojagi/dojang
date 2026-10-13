import { describe, expect, test } from "bun:test";
import { validateGovernanceReadback } from "../scripts/robinhood-deploy-show-core.mjs";

const base = {
  constructorArguments: ["0xregistry", "0xadmin", "3600", "2", "604800", "0"],
  votingPeriod: 3600n,
  quorum: 2n,
  executionWindow: 604800n,
  minimumRemainingValidity: 3600n,
  nextProposalId: 2n,
  proposalOne: {
    finalized: true,
    approved: true,
    executed: true,
    proposedMinimumRemainingValidity: 3600n,
  },
  proposalOneState: 6n,
};

describe("Robinhood deployment governance readback", () => {
  test("accepts 3600 seconds only when Proposal #1 executed that value", () => {
    expect(validateGovernanceReadback(base)).toContain("Proposal #1 is finalized, approved and executed");
    expect(validateGovernanceReadback({ ...base, proposalOneState: 6 })).toContain("Proposal #1 is finalized, approved and executed");
  });

  test("accepts the constructor value before any proposal exists", () => {
    expect(validateGovernanceReadback({
      ...base,
      minimumRemainingValidity: 0n,
      nextProposalId: 1n,
      proposalOne: undefined,
      proposalOneState: undefined,
    })).toContain("no proposals exist");
  });

  test("accepts an unexecuted proposal only while the constructor value remains unchanged", () => {
    expect(validateGovernanceReadback({
      ...base,
      minimumRemainingValidity: 0n,
      proposalOne: { ...base.proposalOne, finalized: false, approved: false, executed: false },
      proposalOneState: 2n,
    })).toContain("Proposal #1 has not executed");
  });

  test("rejects a changed value without an executed proposal", () => {
    expect(() => validateGovernanceReadback({
      ...base,
      minimumRemainingValidity: 3600n,
      proposalOne: { ...base.proposalOne, executed: false },
      proposalOneState: 2n,
    })).toThrow("Governance minimum validity changed before Proposal #1 execution");
  });

  test("rejects an executed proposal that does not match the live value or expected policy", () => {
    expect(() => validateGovernanceReadback({
      ...base,
      minimumRemainingValidity: 1800n,
    })).toThrow("Current minimum validity does not match executed Proposal #1");
    expect(() => validateGovernanceReadback({
      ...base,
      proposalOne: { ...base.proposalOne, proposedMinimumRemainingValidity: 1800n },
    })).toThrow("Executed Proposal #1 does not contain the approved validity value");
  });

  test("rejects changed constructor parameters and mismatched proposal lifecycle state", () => {
    expect(() => validateGovernanceReadback({
      ...base,
      constructorArguments: [...base.constructorArguments.slice(0, 5), "3600"],
    })).toThrow("Governance constructor parameters do not match the approved deployment values");
    expect(() => validateGovernanceReadback({ ...base, proposalOneState: 3n }))
      .toThrow("Proposal #1 executed flag and lifecycle state disagree");
  });
});
