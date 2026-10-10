"use client";

import { useCallback, useMemo, useState } from "react";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { useLendingCredential } from "@/hooks/use-lending-credential";
import { projectContracts } from "@/lib/config/contracts";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import {
  LENDING_POLICY_ID,
  LENDING_POLICY_VERSION,
  LENDING_ELIGIBILITY_THRESHOLD,
  isLendingProofForContext,
  lendingProofContextForCredential,
} from "@/lib/lending/config";
import { generateEligibilityProof } from "@/lib/zk/eligibility-prover";
import { ProtocolError, type EligibilityProof, type LendingProofState } from "@/lib/protocol/types";
import type { DemoCredentialWitness } from "@/lib/credential/witness";

function witnessMatches(witness: DemoCredentialWitness | undefined, input: {
  wallet: string;
  commitment: string;
  expiresAt: bigint;
}): boolean {
  return Boolean(
    witness &&
      witness.policyId === Number(LENDING_POLICY_ID) &&
      witness.wallet.toLowerCase() === input.wallet.toLowerCase() &&
      witness.commitment.toLowerCase() === input.commitment.toLowerCase() &&
      BigInt(witness.expiresAt) === input.expiresAt,
  );
}

export function useLendingEligibilityProof(witness?: DemoCredentialWitness): {
  state: LendingProofState;
  proof?: EligibilityProof;
  error?: string;
  generateProof: (witnessOverride?: DemoCredentialWitness) => Promise<EligibilityProof>;
} {
  const account = useWalletNetwork();
  const credential = useLendingCredential();
  const [storedProof, setStoredProof] = useState<EligibilityProof>();
  const [generatedForWitness, setGeneratedForWitness] = useState<DemoCredentialWitness>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string>();
  const lendingPool = projectContracts.lendingPool;

  const context = useMemo(() => {
    if (!account.address || !credential.record || !lendingPool) return undefined;
    return lendingProofContextForCredential({
      subject: account.address,
      record: credential.record,
      lendingPool,
    });
  }, [account.address, credential.record, lendingPool]);

  const proof = context && isLendingProofForContext(storedProof, context) ? storedProof : undefined;
  const currentWitness = witness ?? generatedForWitness;
  const matchesWitness = Boolean(
    credential.record &&
      account.address &&
      witnessMatches(currentWitness, {
        wallet: account.address,
        commitment: credential.record.commitment,
        expiresAt: credential.record.expiresAt,
      }),
  );

  let state: LendingProofState;
  if (!lendingPool || !credential.hasRegistry) state = "unconfigured";
  else if (!account.address) state = "disconnected";
  else if (!account.isGiwaSepolia) state = "wrong-network";
  else if (credential.state === "checking") state = "checking-credential";
  else if (credential.state === "unconfigured") state = "unconfigured";
  else if (credential.state === "missing") state = "credential-required";
  else if (credential.state === "expired") state = "credential-expired";
  else if (credential.state === "revoked") state = "credential-revoked";
  else if (credential.state === "issuer-untrusted") state = "issuer-untrusted";
  else if (credential.state !== "active") state = "invalid";
  else if (isGenerating) state = "generating";
  else if (!currentWitness) state = "witness-required";
  else if (!matchesWitness) state = "invalid";
  else if (proof) state = "proof-ready";
  else if (generationError) state = "invalid";
  else state = "ready-to-prove";

  const generateProof = useCallback(async (
    witnessOverride?: DemoCredentialWitness,
  ): Promise<EligibilityProof> => {
    const selectedWitness = witnessOverride ?? witness;
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the credential wallet to prove lending eligibility.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch to GIWA Sepolia before generating a lending proof.");
    if (!lendingPool || !credential.record) {
      throw new ProtocolError("LENDING_NOT_CONFIGURED", "Configure the lending pool and registry before generating a lending proof.");
    }
    if (credential.state !== "active") {
      throw new ProtocolError("CREDENTIAL_REQUIRED", "An active lending credential from an authorized issuer is required.");
    }
    if (!selectedWitness) throw new ProtocolError("CREDENTIAL_REQUIRED", "Import the private lending witness before generating a proof.");
    if (!witnessMatches(selectedWitness, {
      wallet: account.address,
      commitment: credential.record.commitment,
      expiresAt: credential.record.expiresAt,
    })) {
      throw new ProtocolError("CREDENTIAL_MISMATCH", "The private witness does not match this wallet's active lending credential.");
    }

    const publicContext = lendingProofContextForCredential({
      subject: account.address,
      record: credential.record,
      lendingPool,
    });
    if (
      publicContext.policyId !== LENDING_POLICY_ID ||
      publicContext.policyVersion !== LENDING_POLICY_VERSION ||
      publicContext.threshold !== LENDING_ELIGIBILITY_THRESHOLD ||
      publicContext.chainId !== BigInt(GIWA_CHAIN_ID)
    ) {
      throw new ProtocolError("INVALID_PROOF", "The lending proof policy context is not supported by this deployment.");
    }

    setIsGenerating(true);
    setGenerationError(undefined);
    setStoredProof(undefined);
    try {
      const generatedProof = await generateEligibilityProof(selectedWitness, publicContext);
      if (!isLendingProofForContext(generatedProof, publicContext)) {
        throw new ProtocolError("INVALID_PROOF", "The generated proof is not bound to this lending pool and credential.");
      }
      setStoredProof(generatedProof);
      setGeneratedForWitness(selectedWitness);
      return generatedProof;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local lending proof generation failed.";
      setGenerationError(message);
      throw error instanceof ProtocolError
        ? error
        : new ProtocolError("INVALID_PROOF", `Lending proof generation or local verification failed: ${message}`, error);
    } finally {
      setIsGenerating(false);
    }
  }, [account.address, account.isGiwaSepolia, credential.record, credential.state, lendingPool, witness]);

  return useMemo(() => ({
    state,
    proof,
    error: generationError ?? (state === "unconfigured"
      ? "Set NEXT_PUBLIC_LENDING_POOL_CONTRACT and NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT before proving."
      : state === "invalid"
        ? generationError ?? "The witness, credential, or generated proof does not match the lending policy context."
        : undefined),
    generateProof,
  }), [generationError, generateProof, proof, state]);
}
