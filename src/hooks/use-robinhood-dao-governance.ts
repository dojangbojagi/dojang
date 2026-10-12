"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decodeEventLog, isAddressEqual, type TransactionReceipt } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { robinhoodContracts } from "@/lib/config/contracts";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { robinhoodGovernanceAbi } from "@/lib/contracts/abis";
import { daoGovernanceQueryKey } from "@/lib/governance/query-key";
import { readRobinhoodGovernanceSnapshot } from "@/lib/governance/robinhood-service";
import type { GovernanceProposalState, GovernanceVoteType, GovernanceWriteResult, TransactionLifecycle } from "@/lib/protocol/types";
import { ProtocolError } from "@/lib/protocol/types";

const voteTypeIndex: Record<GovernanceVoteType, number> = { against: 0, for: 1, abstain: 2 };
const proposalStateByIndex: readonly (GovernanceProposalState | undefined)[] = [
  undefined, "pending", "active", "succeeded", "rejected", "expired", "executed",
];

interface WriteContext {
  address: NonNullable<typeof robinhoodContracts.governance>;
  registry: NonNullable<typeof robinhoodContracts.credentialRegistry>;
  wallet: NonNullable<ReturnType<typeof useWalletNetwork>["address"]>;
  client: NonNullable<ReturnType<typeof usePublicClient>>;
}

function errorMessage(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const value = current as { message?: unknown; shortMessage?: unknown; cause?: unknown };
    const message = typeof value.shortMessage === "string" ? value.shortMessage : value.message;
    if (typeof message === "string") return message;
    current = value.cause;
  }
  return "The Robinhood Testnet governance request failed. Check the RPC connection and try again.";
}

function explainRobinhoodGovernanceError(error: unknown): string {
  if (error instanceof ProtocolError) return error.message;
  const raw = errorMessage(error);
  const lower = raw.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) return "The wallet request was rejected. No transaction was submitted.";
  if (lower.includes("insufficient funds")) return "This wallet does not have enough Robinhood Testnet ETH to pay the network fee.";
  if (lower.includes("notverifiedmember")) return "A current project-issued policy-4 DAO credential is required. Official Dojang credentials are not used on Robinhood Testnet.";
  if (lower.includes("credentialreadfailed")) return "The project credential registry could not be read. DAO membership was not granted.";
  if (lower.includes("wrong network") || lower.includes("unsupportedchain")) return "Switch to Robinhood Chain Testnet (chain 46630) before using this DAO.";
  if (lower.includes("alreadyvoted")) return "This wallet has already voted on this proposal.";
  if (lower.includes("votingnotstarted")) return "Voting has not opened for this proposal yet.";
  if (lower.includes("votingclosed")) return "The voting deadline for this proposal has passed.";
  if (lower.includes("proposalstillactive")) return "This proposal can be finalized after its voting deadline.";
  if (lower.includes("proposalnotfinalized")) return "Finalize the voting outcome before executing this proposal.";
  if (lower.includes("proposalnotsucceeded")) return "Only a successful, unexpired proposal can be executed.";
  if (lower.includes("accesspolicyrequireslongercredentialvalidity")) return "This project credential does not remain valid long enough for the current access policy.";
  if (/contractfunctionexecutionerror|reverted with the following signature|unable to decode signature|docs: https:\/\/viem\.sh|version: viem|request arguments|raw call arguments/i.test(raw)) {
    return "The Robinhood governance contract rejected this action, so no protocol state was changed.";
  }
  return "Robinhood Testnet could not complete the governance RPC request. No successful state change was confirmed; refresh and try again.";
}

/** Robinhood Testnet DAO hook. Its only membership source is policy 4 in the project-issued registry. */
export function useRobinhoodDaoGovernance(enabled = true) {
  const account = useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID);
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const contractAddress = robinhoodContracts.governance;
  const registryAddress = robinhoodContracts.credentialRegistry;
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });
  const queryKey = useMemo(
    () => daoGovernanceQueryKey(contractAddress, account.address, undefined, ROBINHOOD_TESTNET_CHAIN_ID),
    [account.address, contractAddress],
  );
  const snapshotQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!client || !contractAddress || !registryAddress) throw new Error("Robinhood governance and credential registry addresses are not configured.");
      return readRobinhoodGovernanceSnapshot(client, contractAddress, registryAddress, account.address);
    },
    enabled: Boolean(enabled && client && contractAddress && registryAddress),
    refetchInterval: 15_000,
    retry: 1,
  });

  const readiness = snapshotQuery.data?.state;
  let state: "unconfigured" | "checking" | "ready" | "no-code" | "dependency-mismatch" | "read-error";
  if (!enabled || !contractAddress || !registryAddress) state = "unconfigured";
  else if (snapshotQuery.isError) state = "read-error";
  else if (snapshotQuery.isPending) state = "checking";
  else if (readiness === "no-code") state = "no-code";
  else if (readiness === "dependency-mismatch") state = "dependency-mismatch";
  else state = "ready";

  const ensureWriteContext = useCallback((): WriteContext => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect a wallet to use Robinhood governance.");
    if (!account.isRobinhoodTestnet) throw new ProtocolError("WRONG_NETWORK", "Switch to Robinhood Chain Testnet before submitting a governance transaction.");
    if (!contractAddress || !registryAddress || !client) {
      throw new ProtocolError("GOVERNANCE_NOT_CONFIGURED", "Configure the Robinhood governance and project credential registry addresses after deployment.");
    }
    return { address: contractAddress, registry: registryAddress, wallet: account.address, client };
  }, [account.address, account.isRobinhoodTestnet, client, contractAddress, registryAddress]);

  const requireDeployment = useCallback(async (context: WriteContext) => {
    const governanceCode = await context.client.getBytecode({ address: context.address });
    if (!governanceCode || governanceCode === "0x") throw new ProtocolError("GOVERNANCE_NOT_CONFIGURED", "There is no governance contract code at the configured Robinhood address.");
    const [registryCode, configuredRegistry] = await Promise.all([
      context.client.getBytecode({ address: context.registry }),
      context.client.readContract({ address: context.address, abi: robinhoodGovernanceAbi, functionName: "credentialRegistry" }),
    ]);
    if (!registryCode || registryCode === "0x" || !isAddressEqual(configuredRegistry, context.registry)) {
      throw new ProtocolError("GOVERNANCE_NOT_CONFIGURED", "The governance contract does not use the configured Robinhood project credential registry.");
    }
  }, []);

  const requireMember = useCallback(async (context: WriteContext) => {
    const member = await context.client.readContract({
      address: context.address,
      abi: robinhoodGovernanceAbi,
      functionName: "isVerifiedMember",
      args: [context.wallet],
    });
    if (!member) throw new ProtocolError("CREDENTIAL_REQUIRED", "A current project-issued policy-4 DAO credential is required. This is not official Dojang verification.");
  }, []);

  const submitWrite = useCallback(async <TResult,>(
    context: WriteContext,
    simulate: () => Promise<{ request: unknown; result: TResult }>,
    confirmReadback: (result: TResult, receipt: TransactionReceipt) => Promise<boolean>,
  ): Promise<GovernanceWriteResult<TResult> | undefined> => {
    let hash: `0x${string}` | undefined;
    let explorerUrl: string | undefined;
    setTransaction({ state: "simulating" });
    try {
      await requireDeployment(context);
      const simulation = await simulate();
      setTransaction({ state: "awaiting-signature" });
      hash = await writer.writeContractAsync(simulation.request as Parameters<typeof writer.writeContractAsync>[0]);
      explorerUrl = `${ROBINHOOD_TESTNET_EXPLORER_URL}/tx/${hash}`;
      setTransaction({ state: "submitted", hash, explorerUrl });
      setTransaction({ state: "confirming", hash, explorerUrl });
      const receipt = await context.client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl, error: "The Robinhood governance transaction reverted." });
        return undefined;
      }
      if (!(await confirmReadback(simulation.result, receipt))) {
        setTransaction({ state: "rpc-error", hash, explorerUrl, error: "The receipt succeeded, but the expected Robinhood governance state readback is not confirmed yet." });
        return undefined;
      }
      await queryClient.invalidateQueries({ queryKey: ["dao-governance", ROBINHOOD_TESTNET_CHAIN_ID, contractAddress] });
      await queryClient.invalidateQueries({ queryKey: ["dao-proposal-feed", ROBINHOOD_TESTNET_CHAIN_ID, contractAddress] });
      setTransaction({ state: "confirmed", hash, explorerUrl });
      return { result: simulation.result, receipt };
    } catch (error) {
      const raw = error instanceof Error ? error.message.toLowerCase() : "";
      const rejected = raw.includes("user rejected") || raw.includes("user denied");
      setTransaction({ state: rejected ? "rejected" : "rpc-error", hash, explorerUrl, error: explainRobinhoodGovernanceError(error) });
      throw error;
    }
  }, [contractAddress, queryClient, requireDeployment, writer]);

  const createProposal = useCallback(async (input: { contentReference: string; newMinimumRemainingValidity: bigint }): Promise<bigint | undefined> => {
    const context = ensureWriteContext();
    await requireMember(context);
    let proposalId: bigint | undefined;
    await submitWrite(context, async () => {
      const simulation = await context.client.simulateContract({
        account: context.wallet, address: context.address, abi: robinhoodGovernanceAbi,
        functionName: "createProposal", args: [input.contentReference, input.newMinimumRemainingValidity],
      });
      return { request: simulation.request, result: simulation.result };
    }, async (_predicted, receipt) => {
      for (const log of receipt.logs) {
        if (!isAddressEqual(log.address, context.address)) continue;
        try {
          const decoded = decodeEventLog({ abi: robinhoodGovernanceAbi, data: log.data, topics: log.topics });
          if (decoded.eventName !== "ProposalCreated") continue;
          proposalId = decoded.args.proposalId;
          const proposal = await context.client.readContract({ address: context.address, abi: robinhoodGovernanceAbi, functionName: "getProposal", args: [proposalId] });
          return proposal.proposer.toLowerCase() === context.wallet.toLowerCase()
            && proposal.proposedMinimumRemainingValidity === input.newMinimumRemainingValidity
            && proposal.contentReference === input.contentReference;
        } catch { continue; }
      }
      return false;
    });
    return proposalId;
  }, [ensureWriteContext, requireMember, submitWrite]);

  const castVote = useCallback(async (targetProposalId: bigint, vote: GovernanceVoteType) => {
    const context = ensureWriteContext();
    await requireMember(context);
    return submitWrite(context, async () => {
      const simulation = await context.client.simulateContract({
        account: context.wallet, address: context.address, abi: robinhoodGovernanceAbi,
        functionName: "castVote", args: [targetProposalId, voteTypeIndex[vote]],
      });
      return { request: simulation.request, result: undefined };
    }, async () => context.client.readContract({
      address: context.address, abi: robinhoodGovernanceAbi, functionName: "hasVoted", args: [targetProposalId, context.wallet],
    }));
  }, [ensureWriteContext, requireMember, submitWrite]);

  const finalizeProposal = useCallback(async (targetProposalId: bigint) => {
    const context = ensureWriteContext();
    return submitWrite(context, async () => {
      const simulation = await context.client.simulateContract({
        account: context.wallet, address: context.address, abi: robinhoodGovernanceAbi,
        functionName: "finalizeProposal", args: [targetProposalId],
      });
      return { request: simulation.request, result: undefined };
    }, async () => {
      const stateIndex = await context.client.readContract({ address: context.address, abi: robinhoodGovernanceAbi, functionName: "proposalState", args: [targetProposalId] });
      return stateIndex !== 1 && stateIndex !== 2;
    });
  }, [ensureWriteContext, submitWrite]);

  const executeProposal = useCallback(async (targetProposalId: bigint) => {
    const context = ensureWriteContext();
    return submitWrite(context, async () => {
      const simulation = await context.client.simulateContract({
        account: context.wallet, address: context.address, abi: robinhoodGovernanceAbi,
        functionName: "executeProposal", args: [targetProposalId],
      });
      return { request: simulation.request, result: undefined };
    }, async () => {
      const [stateIndex, proposal, currentPolicy] = await Promise.all([
        context.client.readContract({ address: context.address, abi: robinhoodGovernanceAbi, functionName: "proposalState", args: [targetProposalId] }),
        context.client.readContract({ address: context.address, abi: robinhoodGovernanceAbi, functionName: "getProposal", args: [targetProposalId] }),
        context.client.readContract({ address: context.address, abi: robinhoodGovernanceAbi, functionName: "minimumRemainingValidity" }),
      ]);
      return proposal.executed && proposal.approved
        && proposal.proposedMinimumRemainingValidity === currentPolicy
        && proposalStateByIndex[Number(stateIndex)] === "executed";
    });
  }, [ensureWriteContext, submitWrite]);

  const performProtectedAction = useCallback(async () => {
    const context = ensureWriteContext();
    await requireMember(context);
    const previous = await context.client.readContract({ address: context.address, abi: robinhoodGovernanceAbi, functionName: "protectedActionCount", args: [context.wallet] });
    return submitWrite(context, async () => {
      const simulation = await context.client.simulateContract({ account: context.wallet, address: context.address, abi: robinhoodGovernanceAbi, functionName: "performProtectedAction" });
      return { request: simulation.request, result: previous };
    }, async (oldCount) => context.client.readContract({
      address: context.address, abi: robinhoodGovernanceAbi, functionName: "protectedActionCount", args: [context.wallet],
    }).then((count) => count === oldCount + 1n));
  }, [ensureWriteContext, requireMember, submitWrite]);

  const data = snapshotQuery.data?.state === "ready" ? snapshotQuery.data.snapshot : undefined;
  const error = state === "no-code"
    ? new Error("There is no contract code at the configured Robinhood DAO address.")
    : state === "dependency-mismatch"
      ? new Error("The configured Robinhood DAO is missing code at its credential registry or references a different registry.")
      : snapshotQuery.error;

  return {
    state,
    snapshot: data,
    error,
    isLoading: state === "checking",
    isVerifiedMember: data?.isVerifiedMember,
    proposal: data?.proposal,
    transaction,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
    createProposal,
    castVote,
    finalizeProposal,
    executeProposal,
    performProtectedAction,
    refetch: snapshotQuery.refetch,
  };
}
