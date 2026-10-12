# Robinhood DAO Phase 1 Frontend Integration Handoff

Status: Robinhood DAO frontend integration and local read/write journeys implemented; Robinhood Testnet deployment pending. No public DAO address or transaction is confirmed. Updated 2026-10-12.

## Contract and credential boundary

The Robinhood governance contract is [`RobinhoodGovernancePhase1.sol`](../contracts/src/RobinhoodGovernancePhase1.sol), a separate contract from GIWA's `GovernedDojangAccess`. It is constructor-pinned to chain `46630` and uses [`RobinhoodDemoCredentialRegistry.sol`](../contracts/src/RobinhoodDemoCredentialRegistry.sol).

DAO eligibility requires a current project-issued credential under registry policy `4`. Lending V2 uses policy `3`; policy-3 credentials do not grant DAO membership. Membership rechecks the wallet, nonzero commitment, version, issue and expiry times, revocation state, and whether the recorded issuer currently has `ISSUER_ROLE`. This is BOJOGAY project-issued demo eligibility. It is not official Dojang verification, unique-human identity, or exchange verification.

Phase 1 has one bounded governance action: changing `minimumRemainingValidity`, the minimum remaining validity required by the DAO contract's own `performProtectedAction`. It does not change Lending V2 rates, collateral factors, reserve configuration, tokens, or any other contract. There is no treasury or arbitrary-call facility.

## ABI artifact and interface

After `FOUNDRY_PROFILE=robinhood_testnet bun run contracts:build`, the exact compiler-generated ABI is at:

```text
contracts/out/RobinhoodGovernancePhase1.sol/RobinhoodGovernancePhase1.json
```

Use that artifact ABI for a Robinhood-specific client. The current `daoGovernanceAbi` in `src/lib/contracts/abis.ts` targets GIWA `GovernedDojangAccess` and includes Dojang-only getters; it must not be used as the Robinhood ABI.

Core reads:

```solidity
credentialRegistry() view returns (address)
GOVERNANCE_CREDENTIAL_POLICY_ID() view returns (uint256) // 4
votingPeriod() view returns (uint64)
quorum() view returns (uint256)                           // absolute voter count
executionWindow() view returns (uint64)
minimumRemainingValidity() view returns (uint64)
nextProposalId() view returns (uint256)                   // starts at 1
isVerifiedMember(address wallet) view returns (bool)
hasVoted(uint256 proposalId, address voter) view returns (bool)
proposalState(uint256 proposalId) view returns (uint8)
proposalTiming(uint256 proposalId) view returns (uint64 startAt, uint64 deadline, uint64 executionDeadline)
proposalVoteCounts(uint256 proposalId) view returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes)
getProposal(uint256 proposalId) view returns (Proposal)
protectedActionCount(address wallet) view returns (uint256)
paused() view returns (bool)
hasRole(bytes32 role, address account) view returns (bool)
```

The proposal tuple is:

```text
(address proposer, string contentReference, uint64 createdAt, uint64 startAt,
 uint64 deadline, uint64 executionDeadline, uint64 proposedMinimumRemainingValidity,
 uint256 forVotes, uint256 againstVotes, uint256 abstainVotes,
 bool finalized, bool approved, bool executed)
```

State values are `0 None`, `1 Pending`, `2 Active`, `3 Succeeded`, `4 Rejected`, `5 Expired`, `6 Executed`. `proposalState` reverts with `InvalidProposal()` for an unknown ID. An empty feed is `nextProposalId() == 1` and no `ProposalCreated` logs.

Transactions:

```solidity
createProposal(string contentReference, uint64 newMinimumRemainingValidity) returns (uint256 proposalId)
castVote(uint256 proposalId, uint8 voteType) // 0 Against, 1 For, 2 Abstain
finalizeProposal(uint256 proposalId)
executeProposal(uint256 proposalId)
performProtectedAction()
pause()   // PAUSER_ROLE
unpause() // DEFAULT_ADMIN_ROLE
```

`createProposal` and `castVote` require current policy-4 membership. A wallet can vote once. Proposals start one minute after creation; votes close at the configured deadline. Anyone may finalize after the deadline. Execution requires a finalized successful proposal before its execution deadline and is disabled while paused. `performProtectedAction` requires membership and the governed remaining-validity rule.

Events used for discovery and updates:

```text
ProposalCreated(uint256 indexed proposalId, address indexed proposer, uint64 startAt,
  uint64 deadline, uint64 executionDeadline, uint64 proposedMinimumRemainingValidity,
  string contentReference)
VoteCast(uint256 indexed proposalId, address indexed voter, uint8 voteType)
ProposalFinalized(uint256 indexed proposalId, bool approved, uint256 forVotes,
  uint256 againstVotes, uint256 abstainVotes, uint256 quorum)
ProposalExecuted(uint256 indexed proposalId, uint64 minimumRemainingValidity)
MinimumRemainingValidityChanged(uint64 previousValue, uint64 newValue, uint256 indexed proposalId)
ProtectedActionPerformed(address indexed wallet, uint64 minimumRemainingValidity, uint256 actionCount)
```

Important errors include `UnsupportedChain`, `UnconfiguredCredentialRegistry`, `NotVerifiedMember(address)`, `CredentialReadFailed`, `VotingNotStarted`, `VotingClosed`, `AlreadyVoted`, `AlreadyFinalized`, `ProposalStillActive`, `ProposalNotFinalized`, `ProposalNotSucceeded`, `UnauthorizedAction`, `InvalidMinimumRemainingValidity`, and `AccessPolicyRequiresLongerCredentialValidity(uint64)`.

## Exact configuration and guards

The deployment output name is `RH_TESTNET_GOVERNANCE_ADDRESS`; the public read-only frontend config key is `NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT`. The application reads it into `robinhoodContracts.governance`; the Robinhood registry is configured separately through `NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT`. Both outputs remain blank until an authorized deployment has a successful receipt, code readback, and dependency verification. Never use a simulated CREATE address as deployment evidence.

Before enabling a Robinhood DAO client, require:

1. Wallet `chainId === 46630`.
2. Configured DAO and registry addresses are valid and both have runtime code on that same client.
3. `governance.credentialRegistry()` equals the configured Robinhood registry.
4. The wallet's `isVerifiedMember` read succeeds and returns `true` before showing member-only writes. A read failure is an error, not an unverified success.
5. Proposal/vote writes use `policy 4`; Lending V2's policy-3 credential/read state is not a DAO substitute.
6. Simulate each write, request a real wallet signature, wait for a successful receipt, confirm the matching DAO event and state readback, then invalidate chain-46630 query data. Use the application's normal transaction lifecycle; never show a simulated write as confirmed.

The existing DAO page now selects the GIWA or Robinhood client while retaining the current component structure and styling. GIWA continues to use `useDaoGovernance` and the official-Dojang ABI. Robinhood uses a separate hook and ABI; no Robinhood DAO transaction or read depends on GIWA's DojangScroll, EAS, attester book, or GIWA RPC.

## Implemented frontend interfaces

- `src/lib/contracts/abis.ts` exports `robinhoodGovernanceAbi`. The existing `daoGovernanceAbi` remains the GIWA official-Dojang contract ABI.
- `src/lib/config/env.ts` validates `NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT`; `src/lib/config/contracts.ts` exports the validated value as `robinhoodContracts.governance`.
- `src/hooks/use-robinhood-dao-governance.ts` exports `useRobinhoodDaoGovernance(enabled = true)`. Its return shape matches the existing DAO controller: `state`, `snapshot`, `error`, `isLoading`, `isVerifiedMember`, `proposal`, `transaction`, `isSubmitting`, `createProposal`, `castVote`, `finalizeProposal`, `executeProposal`, `performProtectedAction`, and `refetch`.
- `src/hooks/use-dao-proposal-feed.ts` exports `useDaoProposalFeed({ chainId?, beforeId?, pageSize? })`. `chainId` defaults to GIWA `91342`; Robinhood uses `46630`. It returns `state`, `page`, `proposals`, `totalProposals`, `nextCursor`, `quorum`, `votingPeriod`, `executionWindow`, `minimumRemainingValidity`, `error`, `isLoading`, and `refetch`.
- `src/lib/governance/robinhood-service.ts` exports `readRobinhoodGovernanceSnapshot(client, dao, registry, wallet?, proposalId?)` and `readRobinhoodGovernanceProposalPage(client, dao, registry, { beforeId?, pageSize?, wallet? })`. The snapshot result distinguishes `ready`, `no-code`, and `dependency-mismatch`; the page result distinguishes `ready`, `no-code`, and `dependency-mismatch`. Proposal discovery walks the DAO's monotonic IDs newest-first, bounded to 50 per page and five concurrent detail reads; it does not scan unbounded logs.
- Robinhood credential display reads policy `4`, checks `ISSUER_ROLE`, and reports active, missing, expired, revoked, issuer-untrusted, or invalid records. The DAO's own `isVerifiedMember` result remains the authorization source. Reads use the latest chain block timestamp; the contract rechecks the credential on every write.
- Governance and feed query keys include the chain ID and DAO address. Confirmed writes invalidate only the selected chain's DAO and proposal-feed data.
- Proposal creation verifies the `ProposalCreated` receipt log and stored proposal. Voting verifies `hasVoted`; finalization verifies lifecycle state; execution verifies the action and resulting policy; protected-action execution verifies the counter increment. Each write simulates, requests wallet confirmation, waits for a successful receipt, then performs its readback.
- The page's network selector lets the connected user choose GIWA (official Dojang) or Robinhood Testnet (project credential). Unconfigured, no-code, mismatched registry, wrong network, insufficient balance, RPC, rejected-signature, and reverted-transaction states fail closed. The Robinhood evidence adapter recognizes configured DAO addresses and events.
- The only displayed DAO action remains the contract's own `minimumRemainingValidity` policy. It does not govern Lending V2 risk parameters.

## Local validation evidence

The local Robinhood Anvil command is `bun run robinhood:protocol:anvil`. It runs a project-issued policy-4 credential flow through proposal, two votes, finalization, execution, and the protected action on an ephemeral chain with ID `46630`; it also checks an empty feed, proposal discovery/readback, quorum, totals, policy-3 separation, and active/revoked/expired credential status. The same run retains the genuine policy-3 proof and Lending V2 transaction lifecycle. This is local test evidence only. It creates no public contract address, receipt, or Robinhood Testnet transaction.
