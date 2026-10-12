import type { Address, PublicClient } from "viem";
import { zeroAddress } from "viem";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { credentialIssuerRoleAbi, credentialRegistryAbi, robinhoodGovernanceAbi } from "@/lib/contracts/abis";
import { ProtocolError } from "@/lib/protocol/types";
import type {
  DemoCredentialRecord,
  GovernanceCredentialState,
  GovernanceProposal,
  GovernanceProposalPage,
  GovernanceProposalPageResult,
  GovernanceProposalState,
  GovernanceSnapshot,
} from "@/lib/protocol/types";

const proposalStateByIndex: readonly (GovernanceProposalState | undefined)[] = [
  undefined, "pending", "active", "succeeded", "rejected", "expired", "executed",
];
const DAO_POLICY_ID = 4n;
const MAX_PAGE_SIZE = 50;
const DETAIL_CONCURRENCY = 5;

interface ProposalTuple {
  proposer: Address;
  contentReference: string;
  createdAt: bigint;
  startAt: bigint;
  deadline: bigint;
  executionDeadline: bigint;
  proposedMinimumRemainingValidity: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  finalized: boolean;
  approved: boolean;
  executed: boolean;
}

function requireRobinhood(client: PublicClient): Promise<number> {
  return client.getChainId().then((chainId) => {
    if (chainId !== ROBINHOOD_TESTNET_CHAIN_ID) {
      throw new ProtocolError(
        "WRONG_NETWORK",
        `Robinhood governance reads require chain ${ROBINHOOD_TESTNET_CHAIN_ID}; RPC reports chain ${chainId}.`,
      );
    }
    return chainId;
  });
}

async function checkDeployment(client: PublicClient, address: Address, registry: Address) {
  await requireRobinhood(client);
  const code = await client.getBytecode({ address });
  if (!code || code === "0x") return "no-code" as const;

  const registryCode = await client.getBytecode({ address: registry });
  if (!registryCode || registryCode === "0x") return "dependency-mismatch" as const;
  const configuredRegistry = await client.readContract({
    address,
    abi: robinhoodGovernanceAbi,
    functionName: "credentialRegistry",
  });
  if (configuredRegistry.toLowerCase() !== registry.toLowerCase()) return "dependency-mismatch" as const;
  return "ready" as const;
}

async function readCredential(
  client: PublicClient,
  registry: Address,
  wallet: Address,
  chainTimestamp: bigint,
): Promise<{ credentialState: GovernanceCredentialState; credential?: DemoCredentialRecord }> {
  const record = await client.readContract({
    address: registry,
    abi: credentialRegistryAbi,
    functionName: "getCredential",
    args: [wallet, DAO_POLICY_ID],
  });
  if (!record.wallet || record.wallet.toLowerCase() === zeroAddress) return { credentialState: "missing" };

  const credential: DemoCredentialRecord = {
    wallet: record.wallet,
    commitment: record.commitment,
    issuer: record.issuer,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    version: record.version,
    revoked: record.revoked,
  };
  if (record.revoked) return { credentialState: "revoked", credential };
  if (record.expiresAt <= chainTimestamp) return { credentialState: "expired", credential };
  if (
    record.wallet.toLowerCase() !== wallet.toLowerCase() ||
    /^0x0{64}$/i.test(record.commitment) ||
    record.issuer.toLowerCase() === zeroAddress ||
    record.version === 0n ||
    record.issuedAt > chainTimestamp
  ) return { credentialState: "invalid", credential };

  const issuerRole = await client.readContract({
    address: registry,
    abi: credentialIssuerRoleAbi,
    functionName: "ISSUER_ROLE",
  });
  const issuerAuthorized = await client.readContract({
    address: registry,
    abi: credentialIssuerRoleAbi,
    functionName: "hasRole",
    args: [issuerRole, record.issuer],
  });
  return { credentialState: issuerAuthorized ? "active" : "issuer-untrusted", credential };
}

async function readProposal(
  client: PublicClient,
  address: Address,
  proposalId: bigint,
  wallet?: Address,
): Promise<GovernanceProposal> {
  const [raw, stateIndex, voteCounts, walletHasVoted] = await Promise.all([
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "getProposal", args: [proposalId] }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "proposalState", args: [proposalId] }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "proposalVoteCounts", args: [proposalId] }),
    wallet
      ? client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "hasVoted", args: [proposalId, wallet] })
      : Promise.resolve(undefined),
  ]);
  const proposal = raw as unknown as ProposalTuple;
  const state = proposalStateByIndex[Number(stateIndex)];
  if (!state) throw new Error(`Unknown Robinhood governance proposal state ${String(stateIndex)}.`);
  const [forVotes, againstVotes, abstainVotes] = voteCounts;
  return {
    id: proposalId,
    proposer: proposal.proposer,
    contentReference: proposal.contentReference,
    createdAt: proposal.createdAt,
    startAt: proposal.startAt,
    deadline: proposal.deadline,
    executionDeadline: proposal.executionDeadline,
    proposedMinimumRemainingValidity: proposal.proposedMinimumRemainingValidity,
    forVotes,
    againstVotes,
    abstainVotes,
    finalized: proposal.finalized,
    approved: proposal.approved,
    executed: proposal.executed,
    state,
    walletHasVoted,
  };
}

async function mapWithConcurrency<T, R>(values: readonly T[], concurrency: number, map: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await map(values[index]);
    }
  }));
  return results;
}

export type RobinhoodGovernanceReadiness =
  | { state: "ready"; snapshot: GovernanceSnapshot }
  | { state: "no-code" | "dependency-mismatch" };

export async function readRobinhoodGovernanceSnapshot(
  client: PublicClient,
  address: Address,
  registry: Address,
  wallet?: Address,
  proposalId?: bigint,
): Promise<RobinhoodGovernanceReadiness> {
  const deployment = await checkDeployment(client, address, registry);
  if (deployment !== "ready") return { state: deployment };

  const [votingPeriod, quorum, executionWindow, minimumRemainingValidity, nextProposalId, paused] = await Promise.all([
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "votingPeriod" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "quorum" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "executionWindow" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "minimumRemainingValidity" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "nextProposalId" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "paused" }),
  ]);

  let isVerifiedMember: boolean | undefined;
  let protectedActionCount: bigint | undefined;
  let credentialState: GovernanceCredentialState | undefined;
  let credential: DemoCredentialRecord | undefined;
  if (wallet) {
    const [member, count, block] = await Promise.all([
      client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "isVerifiedMember", args: [wallet] }),
      client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "protectedActionCount", args: [wallet] }),
      client.getBlock({ blockTag: "latest" }),
    ]);
    const credentialStatus = await readCredential(client, registry, wallet, block.timestamp);
    isVerifiedMember = member;
    protectedActionCount = count;
    credentialState = credentialStatus.credentialState;
    credential = credentialStatus.credential;
  }

  const proposal = proposalId === undefined ? undefined : await readProposal(client, address, proposalId, wallet);
  return {
    state: "ready",
    snapshot: {
      votingPeriod,
      quorum,
      executionWindow,
      minimumRemainingValidity,
      nextProposalId,
      isVerifiedMember,
      protectedActionCount,
      credentialState,
      credential,
      credentialPolicyId: DAO_POLICY_ID,
      paused,
      proposal,
    },
  };
}

export async function readRobinhoodGovernanceProposalPage(
  client: PublicClient,
  address: Address,
  registry: Address,
  input: { beforeId?: bigint; pageSize?: number; wallet?: Address } = {},
): Promise<GovernanceProposalPageResult> {
  const deployment = await checkDeployment(client, address, registry);
  if (deployment === "no-code") return { state: "no-code" };
  if (deployment === "dependency-mismatch") return { state: "dependency-mismatch" };

  const pageSize = input.pageSize ?? 20;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`Proposal page size must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
  }
  const [nextProposalId, votingPeriod, quorum, executionWindow, minimumRemainingValidity] = await Promise.all([
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "nextProposalId" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "votingPeriod" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "quorum" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "executionWindow" }),
    client.readContract({ address, abi: robinhoodGovernanceAbi, functionName: "minimumRemainingValidity" }),
  ]);
  const totalProposals = nextProposalId > 0n ? nextProposalId - 1n : 0n;
  const upperBound = input.beforeId === undefined ? totalProposals + 1n : input.beforeId;
  const lastId = upperBound - 1n < totalProposals ? upperBound - 1n : totalProposals;
  const ids: bigint[] = [];
  for (let id = lastId; id > 0n && ids.length < pageSize; id -= 1n) ids.push(id);
  const proposals = await mapWithConcurrency(ids, DETAIL_CONCURRENCY, (id) => readProposal(client, address, id, input.wallet));
  const page: GovernanceProposalPage = {
    proposals,
    totalProposals,
    nextCursor: ids.length === pageSize && ids.at(-1)! > 1n ? ids.at(-1) : undefined,
    votingPeriod,
    quorum,
    executionWindow,
    minimumRemainingValidity,
  };
  return { state: "ready", page };
}
