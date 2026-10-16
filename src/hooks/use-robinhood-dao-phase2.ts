"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decodeEventLog, isAddressEqual, type Address, type Hex, type TransactionReceipt } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { getDaoPhase2ContractSet } from "@/lib/config/network-registry";
import type { SupportedProtocolChainId } from "@/lib/config/network-registry";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID, ROBINHOOD_MAINNET_DEMO_EXPLORER_URL } from "@/lib/config/robinhood-mainnet-demo";
import {
  eligibilityVerifierProofAbi,
  robinhoodGovernancePhase2Abi,
} from "@/lib/contracts/abis";
import { readPhase2Snapshot, type Phase2Addresses } from "@/lib/governance/phase2-service";
import type { Phase2BallotSecret } from "@/lib/governance/phase2-types";
import { generateEligibilityProof } from "@/lib/zk/eligibility-prover";
import type { DemoCredentialWitness } from "@/lib/credential/witness";
import type { EligibilityProof, GovernanceWriteResult, TransactionLifecycle } from "@/lib/protocol/types";
import { ProtocolError } from "@/lib/protocol/types";

const voteIndex = { against: 0, for: 1, abstain: 2 } as const;
export type Phase2Vote = keyof typeof voteIndex;

function ballotChainId(chainId: number): Phase2BallotSecret["chainId"] {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID || chainId === ROBINHOOD_MAINNET_CHAIN_ID) return chainId;
  throw new ProtocolError("GOVERNANCE_NOT_CONFIGURED", `DAO Phase 2 is not configured for chain ${chainId}.`);
}

function randomSalt(): Hex {
  if (!globalThis.crypto?.getRandomValues) throw new Error("A secure browser random source is unavailable.");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "The Phase 2 request failed.";
  const lower = raw.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) return "The wallet request was rejected. No transaction was submitted.";
  if (lower.includes("insufficient funds")) return "This wallet does not have enough Robinhood Chain ETH for the network fee.";
  if (lower.includes("notactivemember")) return "Register a current Policy 5 reputation proof before using Phase 2 governance.";
  if (lower.includes("commitnotactive")) return "This proposal is not in its commit window.";
  if (lower.includes("revealnotactive")) return "This proposal is not in its reveal window.";
  if (lower.includes("invalidballotreveal")) return "The reveal file does not match the committed ballot.";
  if (lower.includes("duplicatevote")) return "This wallet has already committed or revealed its ballot for this proposal.";
  return raw;
}

export function useRobinhoodDaoPhase2(proposalId?: bigint, chainId: SupportedProtocolChainId = ROBINHOOD_TESTNET_CHAIN_ID) {
  const account = useWalletNetwork(chainId);
  const client = usePublicClient({ chainId });
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });
  const [proof, setProof] = useState<EligibilityProof>();
  const contractSet = useMemo(() => getDaoPhase2ContractSet(chainId), [chainId]);
  const addresses = useMemo<Phase2Addresses | undefined>(() => {
    const governance = contractSet?.governance;
    const reputationRegistry = contractSet?.reputationRegistry;
    const credentialRegistry = contractSet?.credentialRegistry;
    const verifier = contractSet?.verifier;
    const lendingPool = contractSet?.lendingPool;
    return governance && reputationRegistry && credentialRegistry && verifier && lendingPool
      ? { chainId, governance, reputationRegistry, credentialRegistry, verifier, lendingPool }
      : undefined;
  }, [chainId, contractSet]);
  const queryKey = useMemo(() => [
    "robinhood-dao-phase2",
    chainId,
    addresses?.governance,
    addresses?.reputationRegistry,
    addresses?.credentialRegistry,
    addresses?.verifier,
    addresses?.lendingPool,
    account.address,
    proposalId?.toString() ?? null,
  ] as const, [account.address, addresses, chainId, proposalId]);
  const snapshotQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!client || !addresses) throw new Error("DAO Phase 2 contract addresses are not configured.");
      return readPhase2Snapshot(client, addresses, account.address, proposalId, chainId);
    },
    enabled: Boolean(client && addresses && !contractSet?.phase2DeploymentPending),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const queryData = snapshotQuery.data;
  const readiness = queryData?.state;
  const snapshot = queryData?.state === "ready" ? queryData.snapshot : undefined;
  const state = contractSet?.phase2DeploymentPending
    ? "deployment-pending" as const
    : !addresses
      ? "unconfigured" as const
    : snapshotQuery.isError
      ? "read-error" as const
      : snapshotQuery.isPending
        ? "checking" as const
        : readiness === "no-code"
          ? "no-code" as const
          : readiness === "dependency-mismatch"
            ? "dependency-mismatch" as const
            : "ready" as const;

  const context = useCallback(() => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect a wallet before using DAO Phase 2.");
    if (account.chainId !== chainId) throw new ProtocolError("WRONG_NETWORK", `Switch to ${contractSet?.chainId === ROBINHOOD_MAINNET_CHAIN_ID ? "Robinhood Mainnet (4663)" : "Robinhood Testnet (46630)"}.`);
    if (!client || !addresses) throw new ProtocolError("GOVERNANCE_NOT_CONFIGURED", "DAO Phase 2 is not deployed or configured.");
    return { wallet: account.address, client, addresses };
  }, [account.address, account.chainId, addresses, chainId, client, contractSet]);

  const refresh = useCallback(async () => {
    await snapshotQuery.refetch();
  }, [snapshotQuery]);
  const clearProof = useCallback(() => setProof(undefined), []);

  const submit = useCallback(async <T,>(
    prepare: () => Promise<{ request: unknown; result: T }>,
    confirm: (result: T, receipt: TransactionReceipt) => Promise<boolean>,
  ): Promise<GovernanceWriteResult<T> | undefined> => {
    let hash: Hex | undefined;
    let explorerUrl: string | undefined;
    setTransaction({ state: "simulating" });
    try {
      const simulation = await prepare();
      setTransaction({ state: "awaiting-signature" });
      hash = await writer.writeContractAsync(simulation.request as Parameters<typeof writer.writeContractAsync>[0]);
      const explorerBase = contractSet?.explorerUrl ?? (chainId === ROBINHOOD_MAINNET_CHAIN_ID ? ROBINHOOD_MAINNET_DEMO_EXPLORER_URL : ROBINHOOD_TESTNET_EXPLORER_URL);
      explorerUrl = `${explorerBase}/tx/${hash}`;
      setTransaction({ state: "submitted", hash, explorerUrl });
      setTransaction({ state: "confirming", hash, explorerUrl });
      const receipt = await client!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl, error: "The Phase 2 transaction reverted." });
        return undefined;
      }
      if (!(await confirm(simulation.result, receipt))) {
        setTransaction({ state: "rpc-error", hash, explorerUrl, error: "The receipt succeeded, but the expected state readback is not confirmed yet." });
        return undefined;
      }
      await queryClient.invalidateQueries({ queryKey: ["robinhood-dao-phase2"] });
      setTransaction({ state: "confirmed", hash, explorerUrl });
      return { result: simulation.result, receipt };
    } catch (error) {
      const message = errorMessage(error);
      setTransaction({
        state: /rejected|denied/i.test(message) ? "rejected" : "rpc-error",
        hash,
        explorerUrl,
        error: message,
      });
      throw new Error(message, { cause: error });
    }
  }, [chainId, client, contractSet?.explorerUrl, queryClient, writer]);

  const generateMembershipProof = useCallback(async (witness: DemoCredentialWitness) => {
    const current = context();
    const latest = await readPhase2Snapshot(current.client, current.addresses, current.wallet);
    if (latest.state !== "ready") throw new Error("DAO Phase 2 dependencies failed deployment validation.");
    const data = latest.snapshot;
    if (!data.credentialActive || !data.credential) throw new Error("An active Policy 5 project credential is required.");
    if (!data.reputation?.active) throw new Error("An active Lending V2 reputation claim is required.");
    if (
      data.reputation.commitment.toLowerCase() !== data.credential.commitment.toLowerCase()
        || data.reputation.credentialVersion !== data.credential.version
        || data.reputation.expiresAt !== data.credential.expiresAt
    ) throw new Error("The Policy 5 credential and Lending reputation claim do not describe the same private commitment.");
    if (
      witness.format !== "robinhood-demo-credential-v1" || witness.policyId !== 5
        || !isAddressEqual(witness.wallet, current.wallet)
        || witness.commitment.toLowerCase() !== data.credential.commitment.toLowerCase()
        || BigInt(witness.expiresAt) !== data.credential.expiresAt
    ) throw new Error("The private witness does not match this wallet's active Policy 5 credential.");
    const generated = await generateEligibilityProof(witness, {
      subject: current.wallet,
      commitment: data.credential.commitment,
      policyId: 5n,
      policyVersion: 1n,
      threshold: data.minimumReputation,
      credentialVersion: data.credential.version,
      expiresAt: data.credential.expiresAt,
      chainId: BigInt(chainId),
      vault: current.addresses.governance,
    });
    const accepted = await current.client.readContract({
      address: current.addresses.verifier,
      abi: eligibilityVerifierProofAbi,
      functionName: "verifyProof",
      args: [generated.proof, generated.publicInputs],
    });
    if (!accepted) throw new Error("The deployed verifier rejected the generated Policy 5 proof.");
    setProof(generated);
    return generated;
  }, [chainId, context]);

  const registerMembership = useCallback(async () => {
    const current = context();
    if (!proof) throw new Error("Generate and verify the Policy 5 proof first.");
    return submit(async () => {
      const simulation = await current.client.simulateContract({
        account: current.wallet,
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "registerMembership",
        args: [proof.proof, [...proof.publicInputs]],
      });
      return { request: simulation.request, result: proof.publicContext.credentialVersion };
    }, async (version) => {
      const member = await current.client.readContract({
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "memberships",
        args: [current.wallet],
      });
      const active = await current.client.readContract({
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "isActiveMember",
        args: [current.wallet],
      });
      return member[1] === version && member[4] === proof.publicContext.threshold && active;
    });
  }, [context, proof, submit]);

  const createProposal = useCallback(async (contentReference: string, proposedMinimumReputation: bigint) => {
    const current = context();
    return submit(async () => {
      const simulation = await current.client.simulateContract({
        account: current.wallet,
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "createProposal",
        args: [contentReference, proposedMinimumReputation],
      });
      return { request: simulation.request, result: simulation.result };
    }, async (id, receipt) => receipt.logs.some((log) => {
      if (!isAddressEqual(log.address, current.addresses.governance)) return false;
      try {
        const event = decodeEventLog({ abi: robinhoodGovernancePhase2Abi, data: log.data, topics: log.topics });
        return event.eventName === "ProposalCreated" && event.args.proposalId === id;
      } catch { return false; }
    }));
  }, [context, submit]);

  const commitVote = useCallback(async (targetProposalId: bigint, vote: Phase2Vote) => {
    const current = context();
    const salt = randomSalt();
    const voteType = voteIndex[vote];
    const [commitment, nullifier] = await Promise.all([
      current.client.readContract({
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "ballotCommitment",
        args: [targetProposalId, current.wallet, voteType, salt],
      }),
      current.client.readContract({
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "voteNullifier",
        args: [targetProposalId, current.wallet],
      }),
    ]);
    const ballot: Phase2BallotSecret = {
      format: "gyevo-dao-phase2-ballot-v1",
      chainId: ballotChainId(chainId),
      governance: current.addresses.governance,
      voter: current.wallet,
      proposalId: targetProposalId.toString(),
      voteType,
      salt,
      commitment,
      nullifier,
    };
    const result = await submit(async () => {
      const simulation = await current.client.simulateContract({
        account: current.wallet,
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "commitVote",
        args: [targetProposalId, commitment],
      });
      return { request: simulation.request, result: ballot };
    }, async (saved) => {
      const stored = await current.client.readContract({
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "ballotCommitments",
        args: [targetProposalId, saved.nullifier],
      });
      return stored.toLowerCase() === saved.commitment.toLowerCase();
    });
    return result?.result;
  }, [context, submit]);

  const revealVote = useCallback(async (ballot: Phase2BallotSecret) => {
    const current = context();
    if (
      ballot.format !== "gyevo-dao-phase2-ballot-v1" || ballot.chainId !== chainId
        || !isAddressEqual(ballot.governance, current.addresses.governance)
        || !isAddressEqual(ballot.voter, current.wallet) || !/^[0-2]$/.test(String(ballot.voteType))
        || !/^0x[0-9a-fA-F]{64}$/.test(ballot.salt)
    ) throw new Error("This ballot reveal file does not match the connected wallet and Phase 2 contract.");
    const id = BigInt(ballot.proposalId);
    const [expectedCommitment, expectedNullifier] = await Promise.all([
      current.client.readContract({
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "ballotCommitment",
        args: [id, current.wallet, ballot.voteType, ballot.salt],
      }),
      current.client.readContract({
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "voteNullifier",
        args: [id, current.wallet],
      }),
    ]);
    if (
      expectedCommitment.toLowerCase() !== ballot.commitment.toLowerCase()
        || expectedNullifier.toLowerCase() !== ballot.nullifier.toLowerCase()
    ) throw new Error("This ballot reveal file was changed after the vote was committed.");
    return submit(async () => {
      const simulation = await current.client.simulateContract({
        account: current.wallet,
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "revealVote",
        args: [id, ballot.voteType, ballot.salt],
      });
      return { request: simulation.request, result: ballot.nullifier };
    }, async (nullifier) => current.client.readContract({
      address: current.addresses.governance,
      abi: robinhoodGovernancePhase2Abi,
      functionName: "ballotRevealed",
      args: [id, nullifier],
    }));
  }, [context, submit]);

  useEffect(() => {
    setProof(undefined);
  }, [account.address, addresses?.governance, chainId, snapshot?.credential?.version, snapshot?.minimumReputation]);

  const finalizeProposal = useCallback(async (id: bigint) => {
    const current = context();
    return submit(async () => {
      const simulation = await current.client.simulateContract({
        account: current.wallet,
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "finalizeProposal",
        args: [id],
      });
      return { request: simulation.request, result: id };
    }, async () => {
      const proposal = await current.client.readContract({ address: current.addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "getProposal", args: [id] });
      return proposal.finalized;
    });
  }, [context, submit]);

  const executeProposal = useCallback(async (id: bigint) => {
    const current = context();
    return submit(async () => {
      const simulation = await current.client.simulateContract({
        account: current.wallet,
        address: current.addresses.governance,
        abi: robinhoodGovernancePhase2Abi,
        functionName: "executeProposal",
        args: [id],
      });
      return { request: simulation.request, result: id };
    }, async () => {
      const proposal = await current.client.readContract({ address: current.addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "getProposal", args: [id] });
      return proposal.executed;
    });
  }, [context, submit]);

  return {
    state,
    deployment: contractSet,
    snapshot,
    error: snapshotQuery.error instanceof Error ? snapshotQuery.error.message : undefined,
    transaction,
    proof,
    clearProof,
    generateMembershipProof,
    registerMembership,
    createProposal,
    commitVote,
    revealVote,
    finalizeProposal,
    executeProposal,
    refresh,
  };
}
