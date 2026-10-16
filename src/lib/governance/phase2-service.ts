import { isAddressEqual, zeroAddress, type Address, type PublicClient } from "viem";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import {
  credentialIssuerRoleAbi,
  credentialRegistryAbi,
  robinhoodGovernancePhase2Abi,
  robinhoodLendingReputationAbi,
  robinhoodMainnetDemoMarkerAbi,
} from "@/lib/contracts/abis";
import type { DemoCredentialRecord } from "@/lib/protocol/types";
import type {
  Phase2Membership,
  Phase2Proposal,
  Phase2ProposalState,
  Phase2ReputationClaim,
  Phase2Snapshot,
} from "@/lib/governance/phase2-types";

const POLICY_ID = 5n;
const proposalStates: readonly (Phase2ProposalState | undefined)[] = [
  undefined, "pending", "commit", "reveal", "succeeded", "rejected", "expired", "executed",
];

export interface Phase2Addresses {
  chainId: number;
  governance: Address;
  reputationRegistry: Address;
  credentialRegistry: Address;
  verifier: Address;
  lendingPool: Address;
}

export type Phase2Readiness =
  | { state: "ready"; snapshot: Phase2Snapshot }
  | { state: "no-code" | "dependency-mismatch" };

export async function checkPhase2Deployment(client: PublicClient, addresses: Phase2Addresses, expectedChainId = addresses.chainId) {
  if (addresses.chainId !== expectedChainId) {
    throw new Error(`Phase 2 addresses are configured for chain ${addresses.chainId}; expected ${expectedChainId}.`);
  }
  const chainId = await client.getChainId();
  if (chainId !== expectedChainId) throw new Error(`Phase 2 requires chain ${expectedChainId}; RPC returned ${chainId}.`);
  const targets = [
    addresses.governance,
    addresses.reputationRegistry,
    addresses.credentialRegistry,
    addresses.verifier,
    addresses.lendingPool,
  ];
  const codes = await Promise.all(targets.map((address) => client.getBytecode({ address })));
  if (codes.some((code) => !code || code === "0x")) return "no-code" as const;
  const [registry, reputation, verifier, pool] = await Promise.all([
    client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "credentialRegistry" }),
    client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "reputationRegistry" }),
    client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: addresses.reputationRegistry, abi: robinhoodLendingReputationAbi, functionName: "lendingPool" }),
  ]);
  if (
    !isAddressEqual(registry, addresses.credentialRegistry) || !isAddressEqual(reputation, addresses.reputationRegistry)
      || !isAddressEqual(verifier, addresses.verifier) || !isAddressEqual(pool, addresses.lendingPool)
  ) return "dependency-mismatch" as const;
  if (chainId === 4_663) {
    const [governanceDemo, reputationDemo, registryDemo, lendingDemo] = await Promise.all([
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "demoOnly" }),
      client.readContract({ address: addresses.reputationRegistry, abi: robinhoodLendingReputationAbi, functionName: "demoOnly" }),
      client.readContract({ address: addresses.credentialRegistry, abi: robinhoodMainnetDemoMarkerAbi, functionName: "demoOnly" }),
      client.readContract({ address: addresses.lendingPool, abi: robinhoodMainnetDemoMarkerAbi, functionName: "demoOnly" }),
    ]);
    if (!governanceDemo || !reputationDemo || !registryDemo || !lendingDemo) return "dependency-mismatch" as const;
  }
  return "ready" as const;
}

async function readCredential(client: PublicClient, registry: Address, wallet: Address, now: bigint) {
  const record = await client.readContract({
    address: registry,
    abi: credentialRegistryAbi,
    functionName: "getCredential",
    args: [wallet, POLICY_ID],
  });
  if (isAddressEqual(record.wallet, zeroAddress)) return { active: false };
  const credential: DemoCredentialRecord = { ...record };
  const issuerRole = await client.readContract({
    address: registry,
    abi: credentialIssuerRoleAbi,
    functionName: "ISSUER_ROLE",
  });
  const trusted = await client.readContract({
    address: registry,
    abi: credentialIssuerRoleAbi,
    functionName: "hasRole",
    args: [issuerRole, record.issuer],
  });
  const active = !record.revoked && record.issuedAt <= now && record.expiresAt > now && trusted;
  return { active, credential };
}

async function readProposal(
  client: PublicClient,
  governance: Address,
  proposalId: bigint,
  wallet?: Address,
): Promise<Phase2Proposal> {
  const [proposal, stateIndex] = await Promise.all([
    client.readContract({ address: governance, abi: robinhoodGovernancePhase2Abi, functionName: "getProposal", args: [proposalId] }),
    client.readContract({ address: governance, abi: robinhoodGovernancePhase2Abi, functionName: "proposalState", args: [proposalId] }),
  ]);
  const state = proposalStates[Number(stateIndex)];
  if (!state) throw new Error(`Unknown Phase 2 proposal state ${stateIndex}.`);
  let walletCommitted: boolean | undefined;
  let walletRevealed: boolean | undefined;
  if (wallet) {
    const nullifier = await client.readContract({
      address: governance,
      abi: robinhoodGovernancePhase2Abi,
      functionName: "voteNullifier",
      args: [proposalId, wallet],
    });
    const [commitment, revealed] = await Promise.all([
      client.readContract({ address: governance, abi: robinhoodGovernancePhase2Abi, functionName: "ballotCommitments", args: [proposalId, nullifier] }),
      client.readContract({ address: governance, abi: robinhoodGovernancePhase2Abi, functionName: "ballotRevealed", args: [proposalId, nullifier] }),
    ]);
    walletCommitted = !/^0x0{64}$/i.test(commitment);
    walletRevealed = revealed;
  }
  return { id: proposalId, ...proposal, state, walletCommitted, walletRevealed };
}

export async function readPhase2Snapshot(
  client: PublicClient,
  addresses: Phase2Addresses,
  wallet?: Address,
  proposalId?: bigint,
  expectedChainId = addresses.chainId || ROBINHOOD_TESTNET_CHAIN_ID,
): Promise<Phase2Readiness> {
  const deployment = await checkPhase2Deployment(client, addresses, expectedChainId);
  if (deployment !== "ready") return { state: deployment };
  const [paused, commitPeriod, revealPeriod, executionWindow, quorum, minimumReputation, nextProposalId, block] =
    await Promise.all([
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "paused" }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "commitPeriod" }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "revealPeriod" }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "executionWindow" }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "quorum" }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "minimumReputation" }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "nextProposalId" }),
      client.getBlock({ blockTag: "latest" }),
    ]);
  let credential: DemoCredentialRecord | undefined;
  let credentialActive = false;
  let reputation: Phase2ReputationClaim | undefined;
  let membership: Phase2Membership | undefined;
  if (wallet) {
    const [credentialResult, claim, claimActive, member, memberActive] = await Promise.all([
      readCredential(client, addresses.credentialRegistry, wallet, block.timestamp),
      client.readContract({ address: addresses.reputationRegistry, abi: robinhoodLendingReputationAbi, functionName: "getClaim", args: [wallet] }),
      client.readContract({ address: addresses.reputationRegistry, abi: robinhoodLendingReputationAbi, functionName: "isActiveClaim", args: [wallet] }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "memberships", args: [wallet] }),
      client.readContract({ address: addresses.governance, abi: robinhoodGovernancePhase2Abi, functionName: "isActiveMember", args: [wallet] }),
    ]);
    credential = credentialResult.credential;
    credentialActive = credentialResult.active;
    if (!isAddressEqual(claim.wallet, zeroAddress)) reputation = { ...claim, active: claimActive };
    if (!/^0x0{64}$/i.test(member[0])) {
      membership = {
        commitment: member[0], credentialVersion: member[1], expiresAt: member[2], registeredAt: member[3],
        reputationThreshold: member[4], active: memberActive,
      };
    }
  }
  const proposal = proposalId === undefined
    ? undefined
    : await readProposal(client, addresses.governance, proposalId, wallet);
  return {
    state: "ready",
    snapshot: {
      paused, commitPeriod, revealPeriod, executionWindow, quorum, minimumReputation, nextProposalId,
      credential, credentialActive, reputation, membership, proposal,
    },
  };
}
