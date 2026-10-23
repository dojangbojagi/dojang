"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { getLendingV2ContractSet } from "@/lib/config/network-registry";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { LENDING_V2_POLICY_ID } from "@/lib/lending/v2-config";
import { isRobinhoodLendingV2ProofForContext, robinhoodLendingV2CredentialQueryKey, robinhoodLendingV2DeploymentQueryKey, robinhoodLendingV2ProofContextForCredential, type LendingV2ChainId } from "@/lib/lending/v2-network";
import { LendingV2UnavailableError, readLendingV2Credential, readLendingV2Deployment } from "@/lib/lending/v2-service";
import { eligibilityVerifierProofAbi } from "@/lib/contracts/abis";
import { generateEligibilityProof } from "@/lib/zk/eligibility-prover";
import { ProtocolError, type EligibilityProof, type DemoCredentialRecord } from "@/lib/protocol/types";
import type { DemoCredentialWitness } from "@/lib/credential/witness";
import { isCredentialWitnessForChain } from "@/lib/credential/witness";

export type LendingV2EligibilityState =
  | "unconfigured"
  | "disconnected"
  | "wrong-network"
  | "checking"
  | "unavailable"
  | "read-error"
  | "credential-required"
  | "credential-expired"
  | "credential-revoked"
  | "credential-not-yet-valid"
  | "issuer-untrusted"
  | "witness-required"
  | "witness-mismatch"
  | "ready-to-prove"
  | "generating"
  | "verifier-unavailable"
  | "proof-ready"
  | "invalid";

type ProofVerificationStatus =
  | "not-generated"
  | "locally-verified"
  | "checking-deployed-verifier"
  | "deployed-verifier-accepted"
  | "deployed-verifier-rejected"
  | "deployed-verifier-unavailable";

function matchesV2Witness(witness: DemoCredentialWitness | undefined, wallet: Address, record: DemoCredentialRecord, chainId: LendingV2ChainId): boolean {
  return Boolean(
    witness &&
    isCredentialWitnessForChain(witness, chainId, "robinhood-demo-credential-v1") &&
    witness.policyId === 3 &&
    witness.wallet.toLowerCase() === wallet.toLowerCase() &&
    witness.commitment.toLowerCase() === record.commitment.toLowerCase() &&
    BigInt(witness.expiresAt) === record.expiresAt,
  );
}

export function useLendingV2EligibilityProof(witness?: DemoCredentialWitness, chainId: LendingV2ChainId = ROBINHOOD_TESTNET_CHAIN_ID): {
  state: LendingV2EligibilityState;
  credentialLabel: "GYEVO Project Credential";
  credential?: DemoCredentialRecord;
  proof?: EligibilityProof;
  verificationStatus: ProofVerificationStatus;
  error?: string;
  generateProof: (witnessOverride?: DemoCredentialWitness) => Promise<EligibilityProof>;
  refetchCredential: () => Promise<void>;
} {
  const account = useWalletNetwork(chainId);
  const client = usePublicClient({ chainId });
  const robinhood = getLendingV2ContractSet(chainId);
  const pool = robinhood?.pool;
  const verifier = robinhood?.verifierAdapter;
  const honkVerifier = robinhood?.verifierDependencies[2];
  const oracle = robinhood?.oracle;
  const configuredPoolValue = robinhood?.pool;
  const invalidPoolConfig = (robinhood?.invalidConfigNames.length ?? 0) > 0 || (robinhood?.missingRequiredConfigNames.length ?? 0) > 0;
  const deploymentQuery = useQuery({
    queryKey: robinhoodLendingV2DeploymentQueryKey(pool, chainId),
    queryFn: () => {
      if (!client || !pool) throw new LendingV2UnavailableError("Lending V2 is not configured.");
      return readLendingV2Deployment(client, pool, robinhood?.credentialRegistry, undefined, chainId, verifier, oracle, honkVerifier, robinhood?.configuredAssets);
    },
    enabled: Boolean(pool && client && !invalidPoolConfig && !(robinhood?.missingRequiredConfigNames.length)),
    retry: 1,
    staleTime: 15_000,
  });
  const registry = deploymentQuery.data?.credentialRegistry;
  const credentialQuery = useQuery({
    queryKey: robinhoodLendingV2CredentialQueryKey(registry, account.address, chainId),
    queryFn: () => {
      if (!client || !registry || !account.address) throw new Error("The V2 credential read is not configured.");
      return readLendingV2Credential(client, registry, account.address);
    },
    enabled: Boolean(client && registry && account.address && account.isOnExpectedNetwork),
    retry: 1,
    staleTime: 5_000,
  });
  const [storedProof, setStoredProof] = useState<EligibilityProof>();
  const [proofWitness, setProofWitness] = useState<DemoCredentialWitness>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string>();
  const [verificationStatus, setVerificationStatus] = useState<ProofVerificationStatus>("not-generated");
  const credential = credentialQuery.data?.record;
  const currentWitness = witness ?? proofWitness;
  const witnessMatches = Boolean(account.address && credential && matchesV2Witness(currentWitness, account.address, credential, chainId));
  const context = useMemo(() => {
    if (!pool || !account.address || !credential) return undefined;
    return robinhoodLendingV2ProofContextForCredential({ subject: account.address, record: credential, lendingPool: pool, chainId });
  }, [account.address, chainId, credential, pool]);
  const proof = context && credentialQuery.data?.state === "active" && witnessMatches &&
    isRobinhoodLendingV2ProofForContext(storedProof, context, chainId) ? storedProof : undefined;

  useEffect(() => {
    setStoredProof(undefined);
    setProofWitness(undefined);
    setGenerationError(undefined);
    setVerificationStatus("not-generated");
  }, [account.address, chainId, credential?.commitment, credential?.expiresAt, pool, witness?.commitment]);

  let state: LendingV2EligibilityState;
  if (!configuredPoolValue) state = "unconfigured";
  else if (invalidPoolConfig) state = "unavailable";
  else if (!account.address) state = "disconnected";
  else if (!account.isOnExpectedNetwork) state = "wrong-network";
  else if (deploymentQuery.isPending || credentialQuery.isPending) state = "checking";
  else if (deploymentQuery.error instanceof LendingV2UnavailableError) state = "unavailable";
  else if (deploymentQuery.isError || credentialQuery.isError) state = "read-error";
  else if (!deploymentQuery.data || !credentialQuery.data) state = "checking";
  else if (credentialQuery.data.state === "missing") state = "credential-required";
  else if (credentialQuery.data.state === "expired") state = "credential-expired";
  else if (credentialQuery.data.state === "revoked") state = "credential-revoked";
  else if (credentialQuery.data.state === "not-yet-valid") state = "credential-not-yet-valid";
  else if (credentialQuery.data.state === "issuer-untrusted") state = "issuer-untrusted";
  else if (isGenerating) state = "generating";
  else if (!currentWitness) state = "witness-required";
  else if (!witnessMatches) state = "witness-mismatch";
  else if (verificationStatus === "deployed-verifier-unavailable") state = "verifier-unavailable";
  else if (proof) state = "proof-ready";
  else if (generationError) state = "invalid";
  else state = "ready-to-prove";

  const generateProof = useCallback(async (witnessOverride?: DemoCredentialWitness): Promise<EligibilityProof> => {
    const selectedWitness = witnessOverride ?? witness;
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the wallet that owns the V2 project test credential.");
    if (!account.isOnExpectedNetwork) throw new ProtocolError("WRONG_NETWORK", `Switch to Robinhood Chain ${chainId === ROBINHOOD_MAINNET_CHAIN_ID ? "Mainnet" : "Testnet"} before generating a Lending V2 proof.`);
    if (!client || !pool || !deploymentQuery.data) {
      throw new ProtocolError("LENDING_NOT_CONFIGURED", "A compatible Lending V2 deployment is not available.");
    }
    const refreshedCredential = await readLendingV2Credential(client, deploymentQuery.data.credentialRegistry, account.address);
    if (refreshedCredential.state !== "active" || !refreshedCredential.record) {
      throw new ProtocolError("CREDENTIAL_REQUIRED", "An active GYEVO Policy 3 Project Credential from a currently authorized issuer is required.");
    }
    if (!selectedWitness) throw new ProtocolError("CREDENTIAL_REQUIRED", "Import the private GYEVO Policy 3 witness.");
    if (!matchesV2Witness(selectedWitness, account.address, refreshedCredential.record, chainId)) {
      throw new ProtocolError("CREDENTIAL_MISMATCH", "The witness does not match this wallet's active policy-3 credential.");
    }

    const publicContext = robinhoodLendingV2ProofContextForCredential({
      subject: account.address,
      record: refreshedCredential.record,
      lendingPool: pool,
      chainId,
    });
    setIsGenerating(true);
    setGenerationError(undefined);
    setStoredProof(undefined);
    setVerificationStatus("not-generated");
    let verifierFailure: "deployed-verifier-rejected" | "deployed-verifier-unavailable" | undefined;
    try {
      const generated = await generateEligibilityProof(selectedWitness, publicContext);
      if (!isRobinhoodLendingV2ProofForContext(generated, publicContext, chainId)) {
        throw new ProtocolError("INVALID_PROOF", "The locally generated proof is not bound to the V2 policy and pool address.");
      }
      setVerificationStatus("locally-verified");
      setVerificationStatus("checking-deployed-verifier");
      let accepted: boolean;
      try {
        accepted = await client.readContract({
          address: deploymentQuery.data.eligibilityVerifier,
          abi: eligibilityVerifierProofAbi,
          functionName: "verifyProof",
          args: [generated.proof, generated.publicInputs],
        });
      } catch (cause) {
        verifierFailure = "deployed-verifier-unavailable";
        setVerificationStatus(verifierFailure);
        throw new ProtocolError("RPC_ERROR", "The proof passed local verification, but the read-only deployed verifier call failed. No verifier result is claimed.", cause);
      }
      if (!accepted) {
        verifierFailure = "deployed-verifier-rejected";
        setVerificationStatus(verifierFailure);
        throw new ProtocolError("INVALID_PROOF", "The deployed Robinhood verifier adapter returned false for this proof.");
      }
      setProofWitness(selectedWitness);
      setStoredProof(generated);
      setVerificationStatus("deployed-verifier-accepted");
      return generated;
    } catch (error) {
      if (!verifierFailure) setVerificationStatus("not-generated");
      const detail = error instanceof Error ? error.message : "The browser proof operation failed.";
      setGenerationError(detail);
      throw error instanceof ProtocolError
        ? error
        : new ProtocolError("INVALID_PROOF", `Policy-3 proof generation or local verification failed: ${detail}`, error);
    } finally {
      setIsGenerating(false);
    }
  }, [account.address, account.isOnExpectedNetwork, chainId, client, deploymentQuery.data, pool, witness]);

  const refetchCredential = useCallback(async () => {
    if (deploymentQuery.data && account.address) {
      await credentialQuery.refetch();
    }
  }, [account.address, credentialQuery, deploymentQuery.data]);

  const error = generationError ?? (state === "unconfigured"
    ? "Set NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT to the confirmed Robinhood V2 pool address."
    : state === "unavailable"
      ? deploymentQuery.error instanceof Error ? deploymentQuery.error.message : "The configured address is not a compatible deployed V2 pool."
      : state === "read-error"
        ? `The V2 pool or policy-3 credential could not be read from Robinhood Chain ${chainId === ROBINHOOD_MAINNET_CHAIN_ID ? "Mainnet" : "Testnet"}.`
        : state === "credential-required"
          ? "No GYEVO Policy 3 Project Credential is registered for this wallet."
          : state === "credential-expired"
            ? "The GYEVO Policy 3 Project Credential has expired. Request a new project-issued credential."
            : state === "credential-revoked"
              ? "The project issuer revoked this policy-3 credential."
              : state === "credential-not-yet-valid"
                ? "The GYEVO Policy 3 Project Credential is not yet valid."
                : state === "issuer-untrusted"
                  ? "The credential issuer no longer has the project registry issuer role."
                  : state === "verifier-unavailable"
                    ? "The local proof is valid, but the deployed verifier could not be reached. Retry before taking a protected action."
                  : state === "witness-required"
                    ? "Import the private witness for this GYEVO Policy 3 Project Credential."
                    : state === "witness-mismatch"
                      ? "The imported witness does not match the active policy-3 credential."
                      : undefined);

  return {
    state,
    credentialLabel: "GYEVO Project Credential",
    credential,
    proof,
    verificationStatus,
    error,
    generateProof,
    refetchCredential,
  };
}
