"use client";

import { useCallback, useMemo, useState } from "react";
import { isAddressEqual } from "viem";
import { useDemoCredential, DEMO_POLICY_ID, DEMO_POLICY_THRESHOLD } from "@/hooks/use-demo-credential";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { projectContracts } from "@/lib/config/contracts";
import { useDemoWitness } from "@/components/witness-context";
import { generateEligibilityProof, proofContextForCredential } from "@/lib/zk/eligibility-prover";
import { ProtocolError, type EligibilityProof, type ProofState } from "@/lib/protocol/types";

export function useEligibilityProof(): {
  state: ProofState;
  witnessMatchesRecord: boolean;
  proof?: EligibilityProof;
  generateProof: () => Promise<EligibilityProof>;
  error?: string;
} {
  const account = useWalletNetwork();
  const credential = useDemoCredential();
  const { witness, proof: storedProof, setProof } = useDemoWitness();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string>();

  const witnessMatchesRecord = Boolean(
    witness &&
      credential.record &&
      account.address &&
      isAddressEqual(witness.wallet, account.address) &&
      witness.policyId === Number(DEMO_POLICY_ID) &&
      witness.commitment.toLowerCase() === credential.record.commitment.toLowerCase() &&
      BigInt(witness.expiresAt) === credential.record.expiresAt,
  );

  const currentContext = useMemo(() => {
    if (!account.address || !credential.record || !projectContracts.restrictedVault) return undefined;
    return proofContextForCredential({
      subject: account.address,
      commitment: credential.record.commitment,
      credentialVersion: credential.record.version,
      expiresAt: credential.record.expiresAt,
      vault: projectContracts.restrictedVault,
    });
  }, [account.address, credential.record]);

  const proofIsCurrent = Boolean(
    storedProof &&
      currentContext &&
      storedProof.localVerification === "verified" &&
      storedProof.publicContext.subject.toLowerCase() === currentContext.subject.toLowerCase() &&
      storedProof.publicContext.commitment.toLowerCase() === currentContext.commitment.toLowerCase() &&
      storedProof.publicContext.policyId === currentContext.policyId &&
      storedProof.publicContext.policyVersion === currentContext.policyVersion &&
      storedProof.publicContext.threshold === currentContext.threshold &&
      storedProof.publicContext.credentialVersion === currentContext.credentialVersion &&
      storedProof.publicContext.expiresAt === currentContext.expiresAt &&
      storedProof.publicContext.chainId === currentContext.chainId &&
      storedProof.publicContext.vault.toLowerCase() === currentContext.vault.toLowerCase() &&
      storedProof.publicInputs.length === 9 &&
      storedProof.publicInputs[0] === BigInt(currentContext.subject) &&
      storedProof.publicInputs[1] === BigInt(currentContext.commitment) &&
      storedProof.publicInputs[2] === currentContext.policyId &&
      storedProof.publicInputs[3] === currentContext.policyVersion &&
      storedProof.publicInputs[4] === currentContext.threshold &&
      storedProof.publicInputs[5] === currentContext.credentialVersion &&
      storedProof.publicInputs[6] === currentContext.expiresAt &&
      storedProof.publicInputs[7] === currentContext.chainId &&
      storedProof.publicInputs[8] === BigInt(currentContext.vault),
  );

  const state: ProofState = !account.address || credential.state !== "active" || !witness
    ? "credential-required"
    : !witnessMatchesRecord || !account.isGiwaSepolia
      ? "invalid"
      : isGenerating
        ? "generating"
        : !projectContracts.restrictedVault
          ? "contract-unconfigured"
          : proofIsCurrent
            ? "ready-to-submit"
            : "ready-to-prove";

  const generateProof = useCallback(async (): Promise<EligibilityProof> => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the wallet for this credential.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch to GIWA Sepolia before proving.");
    if (credential.state !== "active" || !credential.record || !witness) {
      throw new ProtocolError("CREDENTIAL_REQUIRED", "An active project demo credential and its private witness are required.");
    }
    if (!witnessMatchesRecord) {
      throw new ProtocolError("CREDENTIAL_MISMATCH", "The imported witness does not match this wallet's active on-chain demo credential.");
    }
    if (!projectContracts.restrictedVault) {
      throw new ProtocolError("CONTRACTS_UNCONFIGURED", "The Restricted Vault address has not been configured.");
    }

    const publicContext = proofContextForCredential({
      subject: account.address,
      commitment: credential.record.commitment,
      credentialVersion: credential.record.version,
      expiresAt: credential.record.expiresAt,
      vault: projectContracts.restrictedVault,
    });
    setIsGenerating(true);
    setGenerationError(undefined);
    setProof(null);
    try {
      const generatedProof = await generateEligibilityProof(witness, publicContext);
      setProof(generatedProof);
      return generatedProof;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The local proof operation failed.";
      setGenerationError(message);
      throw new ProtocolError("INVALID_PROOF", `Proof generation or local verification failed: ${message}`, error);
    } finally {
      setIsGenerating(false);
    }
  }, [account.address, account.isGiwaSepolia, credential.record, credential.state, setProof, witness, witnessMatchesRecord]);

  const activeProof = proofIsCurrent ? storedProof ?? undefined : undefined;
  return useMemo(() => ({
    state,
    witnessMatchesRecord,
    proof: activeProof,
    generateProof,
    error: generationError ?? (state === "contract-unconfigured"
      ? "Set NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT to the deployed vault address before generating a proof."
      : state === "invalid"
        ? "Connect the credential wallet on GIWA Sepolia and import a matching witness."
        : undefined),
  }), [activeProof, generateProof, generationError, state, witnessMatchesRecord]);
}
