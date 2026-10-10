import type { Address } from "viem";
import type { DemoCredentialRecord, EligibilityProof, PublicProofInputs } from "@/lib/protocol/types";

export const LENDING_POLICY_ID = 2n;
export const LENDING_POLICY_VERSION = 1n;
export const LENDING_ELIGIBILITY_THRESHOLD = 1_000n;
export const LENDING_MAX_LTV_BPS = 5_000n;
export const LENDING_INTEREST_RATE_BPS = 0n;

export function lendingProofContextForCredential(input: {
  subject: Address;
  record: DemoCredentialRecord;
  lendingPool: Address;
}): PublicProofInputs {
  return {
    subject: input.subject,
    commitment: input.record.commitment,
    policyId: LENDING_POLICY_ID,
    policyVersion: LENDING_POLICY_VERSION,
    threshold: LENDING_ELIGIBILITY_THRESHOLD,
    credentialVersion: input.record.version,
    expiresAt: input.record.expiresAt,
    chainId: 91_342n,
    vault: input.lendingPool,
  };
}

export function isLendingProofForContext(
  proof: EligibilityProof | undefined,
  context: PublicProofInputs,
): proof is EligibilityProof {
  if (!proof || proof.localVerification !== "verified" || proof.publicInputs.length !== 9) return false;
  const publicInputs = [
    BigInt(context.subject),
    BigInt(context.commitment),
    context.policyId,
    context.policyVersion,
    context.threshold,
    context.credentialVersion,
    context.expiresAt,
    context.chainId,
    BigInt(context.vault),
  ];
  return (
    proof.publicContext.subject.toLowerCase() === context.subject.toLowerCase() &&
    proof.publicContext.commitment.toLowerCase() === context.commitment.toLowerCase() &&
    proof.publicContext.policyId === context.policyId &&
    proof.publicContext.policyVersion === context.policyVersion &&
    proof.publicContext.threshold === context.threshold &&
    proof.publicContext.credentialVersion === context.credentialVersion &&
    proof.publicContext.expiresAt === context.expiresAt &&
    proof.publicContext.chainId === context.chainId &&
    proof.publicContext.vault.toLowerCase() === context.vault.toLowerCase() &&
    proof.publicInputs.every((value, index) => value === publicInputs[index])
  );
}
