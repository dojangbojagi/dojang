"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { getLendingV2ContractSet } from "@/lib/config/network-registry";
import { appEnv } from "@/lib/config/env";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { LENDING_V2_POLICY_ID } from "@/lib/lending/v2-config";
import { isRobinhoodLendingV2ProofForContext, robinhoodLendingV2CredentialQueryKey, robinhoodLendingV2DeploymentQueryKey, robinhoodLendingV2ProofContextForCredential } from "@/lib/lending/v2-network";
import { LendingV2UnavailableError, readLendingV2Credential, readLendingV2Deployment } from "@/lib/lending/v2-service";
import { generateEligibilityProof } from "@/lib/zk/eligibility-prover";
import { ProtocolError, type EligibilityProof, type DemoCredentialRecord } from "@/lib/protocol/types";
import type { DemoCredentialWitness } from "@/lib/credential/witness";

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
  | "proof-ready"
  | "invalid";

function matchesV2Witness(witness: DemoCredentialWitness | undefined, wallet: Address, record: DemoCredentialRecord): boolean {
  return Boolean(
    witness &&
    witness.format === "robinhood-demo-credential-v1" &&
    witness.policyId === 3 &&
    witness.wallet.toLowerCase() === wallet.toLowerCase() &&
    witness.commitment.toLowerCase() === record.commitment.toLowerCase() &&
    BigInt(witness.expiresAt) === record.expiresAt,
  );
}

export function useLendingV2EligibilityProof(witness?: DemoCredentialWitness): {
  state: LendingV2EligibilityState;
  credentialLabel: "Project Test Credential";
  credential?: DemoCredentialRecord;
  proof?: EligibilityProof;
  verificationStatus: "not-generated" | "locally-verified";
  error?: string;
  generateProof: (witnessOverride?: DemoCredentialWitness) => Promise<EligibilityProof>;
  refetchCredential: () => Promise<void>;
} {
  const account = useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID);
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const robinhood = getLendingV2ContractSet(ROBINHOOD_TESTNET_CHAIN_ID)!;
  const pool = robinhood.pool;
  const verifier = robinhood.verifierAdapter;
  const honkVerifier = robinhood.verifierDependencies[2];
  const oracle = robinhood.oracle;
  const configuredPoolValue = appEnv.robinhoodContracts.lendingV2Pool;
  const invalidPoolConfig = robinhood.invalidConfigNames.length > 0 || robinhood.missingRequiredConfigNames.length > 0;
  const deploymentQuery = useQuery({
    queryKey: robinhoodLendingV2DeploymentQueryKey(pool),
    queryFn: () => {
      if (!client || !pool) throw new LendingV2UnavailableError("Lending V2 is not configured.");
      return readLendingV2Deployment(client, pool, robinhood.credentialRegistry, undefined, ROBINHOOD_TESTNET_CHAIN_ID, verifier, oracle, honkVerifier);
    },
    enabled: Boolean(pool && client && !invalidPoolConfig),
    retry: 1,
    staleTime: 15_000,
  });
  const registry = deploymentQuery.data?.credentialRegistry;
  const credentialQuery = useQuery({
    queryKey: robinhoodLendingV2CredentialQueryKey(registry, account.address),
    queryFn: () => {
      if (!client || !registry || !account.address) throw new Error("The V2 credential read is not configured.");
      return readLendingV2Credential(client, registry, account.address);
    },
    enabled: Boolean(client && registry && account.address && account.isRobinhoodTestnet),
    retry: 1,
    staleTime: 5_000,
  });
  const [storedProof, setStoredProof] = useState<EligibilityProof>();
  const [proofWitness, setProofWitness] = useState<DemoCredentialWitness>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string>();
  const credential = credentialQuery.data?.record;
  const currentWitness = witness ?? proofWitness;
  const witnessMatches = Boolean(account.address && credential && matchesV2Witness(currentWitness, account.address, credential));
  const context = useMemo(() => {
    if (!pool || !account.address || !credential) return undefined;
    return robinhoodLendingV2ProofContextForCredential({ subject: account.address, record: credential, lendingPool: pool });
  }, [account.address, credential, pool]);
  const proof = context && credentialQuery.data?.state === "active" && witnessMatches &&
    isRobinhoodLendingV2ProofForContext(storedProof, context) ? storedProof : undefined;

  let state: LendingV2EligibilityState;
  if (!configuredPoolValue) state = "unconfigured";
  else if (invalidPoolConfig) state = "unavailable";
  else if (!account.address) state = "disconnected";
  else if (!account.isRobinhoodTestnet) state = "wrong-network";
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
  else if (proof) state = "proof-ready";
  else if (generationError) state = "invalid";
  else state = "ready-to-prove";

  const generateProof = useCallback(async (witnessOverride?: DemoCredentialWitness): Promise<EligibilityProof> => {
    const selectedWitness = witnessOverride ?? witness;
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the wallet that owns the V2 project test credential.");
    if (!account.isRobinhoodTestnet) throw new ProtocolError("WRONG_NETWORK", "Switch to Robinhood Chain Testnet before generating a Lending V2 proof.");
    if (!client || !pool || !deploymentQuery.data) {
      throw new ProtocolError("LENDING_NOT_CONFIGURED", "A compatible Lending V2 deployment is not available.");
    }
    const refreshedCredential = await readLendingV2Credential(client, deploymentQuery.data.credentialRegistry, account.address);
    if (refreshedCredential.state !== "active" || !refreshedCredential.record) {
      throw new ProtocolError("CREDENTIAL_REQUIRED", "An active policy-3 Project Test Credential from a currently authorized issuer is required.");
    }
    if (!selectedWitness) throw new ProtocolError("CREDENTIAL_REQUIRED", "Import the private policy-3 Project Test Credential witness.");
    if (!matchesV2Witness(selectedWitness, account.address, refreshedCredential.record)) {
      throw new ProtocolError("CREDENTIAL_MISMATCH", "The witness does not match this wallet's active policy-3 credential.");
    }

    const publicContext = robinhoodLendingV2ProofContextForCredential({
      subject: account.address,
      record: refreshedCredential.record,
      lendingPool: pool,
    });
    setIsGenerating(true);
    setGenerationError(undefined);
    setStoredProof(undefined);
    try {
      const generated = await generateEligibilityProof(selectedWitness, publicContext);
      if (!isRobinhoodLendingV2ProofForContext(generated, publicContext)) {
        throw new ProtocolError("INVALID_PROOF", "The locally generated proof is not bound to the V2 policy and pool address.");
      }
      setProofWitness(selectedWitness);
      setStoredProof(generated);
      return generated;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The browser proof operation failed.";
      setGenerationError(detail);
      throw error instanceof ProtocolError
        ? error
        : new ProtocolError("INVALID_PROOF", `Policy-3 proof generation or local verification failed: ${detail}`, error);
    } finally {
      setIsGenerating(false);
    }
  }, [account.address, account.isRobinhoodTestnet, client, deploymentQuery.data, pool, witness]);

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
        ? "The V2 pool or policy-3 credential could not be read from Robinhood Chain Testnet."
        : state === "credential-required"
          ? "No policy-3 Project Test Credential is registered for this wallet."
          : state === "credential-expired"
            ? "The policy-3 Project Test Credential has expired. Request a new project-issued credential."
            : state === "credential-revoked"
              ? "The project issuer revoked this policy-3 credential."
              : state === "credential-not-yet-valid"
                ? "The policy-3 Project Test Credential is not yet valid."
                : state === "issuer-untrusted"
                  ? "The credential issuer no longer has the project registry issuer role."
                  : state === "witness-required"
                    ? "Import the private witness for this policy-3 Project Test Credential."
                    : state === "witness-mismatch"
                      ? "The imported witness does not match the active policy-3 credential."
                      : undefined);

  return {
    state,
    credentialLabel: "Project Test Credential",
    credential,
    proof,
    verificationStatus: proof ? "locally-verified" : "not-generated",
    error,
    generateProof,
    refetchCredential,
  };
}
