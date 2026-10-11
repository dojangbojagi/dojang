import type { Address } from "viem";
import type { DemoCredentialRecord, EligibilityProof, PublicProofInputs } from "../protocol/types";

export const LENDING_V2_POLICY_ID = 3n;
export const LENDING_V2_POLICY_VERSION = 1n;
export const LENDING_V2_ELIGIBILITY_THRESHOLD = 1_000n;
export const LENDING_V2_RAY = 10n ** 27n;

export function lendingV2ProofContextForCredential(input: {
  subject: Address;
  record: DemoCredentialRecord;
  lendingPool: Address;
}): PublicProofInputs {
  return {
    subject: input.subject,
    commitment: input.record.commitment,
    policyId: LENDING_V2_POLICY_ID,
    policyVersion: LENDING_V2_POLICY_VERSION,
    threshold: LENDING_V2_ELIGIBILITY_THRESHOLD,
    credentialVersion: input.record.version,
    expiresAt: input.record.expiresAt,
    chainId: 91_342n,
    vault: input.lendingPool,
  };
}

export function isLendingV2ProofForContext(
  proof: EligibilityProof | undefined,
  context: PublicProofInputs,
): proof is EligibilityProof {
  if (!proof || proof.localVerification !== "verified" || proof.publicInputs.length !== 9) return false;
  const expected = [
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
    context.policyId === LENDING_V2_POLICY_ID &&
    context.policyVersion === LENDING_V2_POLICY_VERSION &&
    context.threshold === LENDING_V2_ELIGIBILITY_THRESHOLD &&
    context.chainId === 91_342n &&
    proof.publicContext.subject.toLowerCase() === context.subject.toLowerCase() &&
    proof.publicContext.commitment.toLowerCase() === context.commitment.toLowerCase() &&
    proof.publicContext.policyId === context.policyId &&
    proof.publicContext.policyVersion === context.policyVersion &&
    proof.publicContext.threshold === context.threshold &&
    proof.publicContext.credentialVersion === context.credentialVersion &&
    proof.publicContext.expiresAt === context.expiresAt &&
    proof.publicContext.chainId === context.chainId &&
    proof.publicContext.vault.toLowerCase() === context.vault.toLowerCase() &&
    proof.publicInputs.every((value, index) => value === expected[index])
  );
}

export function lendingV2MarketQueryKey(pool?: Address, wallet?: Address) {
  return [
    "lending-v2-market",
    "91342",
    pool?.toLowerCase() ?? "unconfigured",
    wallet?.toLowerCase() ?? "no-wallet",
  ] as const;
}

export function lendingV2DeploymentQueryKey(pool?: Address) {
  return ["lending-v2-deployment", "91342", pool?.toLowerCase() ?? "unconfigured"] as const;
}

export function lendingV2CredentialQueryKey(registry?: Address, wallet?: Address) {
  return [
    "lending-v2-credential",
    "91342",
    registry?.toLowerCase() ?? "unconfigured",
    wallet?.toLowerCase() ?? "no-wallet",
    "policy-3",
  ] as const;
}
