# DAO Frontend Handoff

This document defines the nonvisual integration surface for DAO presentation on the existing `/dao` route. Governance contract writes, Dojang reads, receipt handling, and error mapping stay in `src/hooks/use-dao-governance.ts` and `src/lib/governance/service.ts`.

## Configuration and trust boundary

- The app reads the project-owned governance address from `NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT`.
- The contract is usable only on GIWA Sepolia, chain ID `91342`.
- Governance membership uses official DojangScroll, DojangAttesterBook, and EAS reads. It never uses `DemoCredentialRegistry`, a demo issuer, or a ZK proof as a governance credential.
- `useDojangVerification(wallet?)` remains the UI's detailed official credential read. Its states are `idle`, `checking`, `official-verified`, `no-official-credential`, `invalid`, `expired`, `revoked`, and `read-error`.
- A transaction hash or local proof does not imply a successful governance action. Use the transaction lifecycle and readback state described below.

## Hook

```ts
useDaoGovernance(proposalId?: bigint) => {
  state: "unconfigured" | "checking" | "ready" | "read-error";
  snapshot?: GovernanceSnapshot;
  error?: Error;
  isLoading: boolean;
  isVerifiedMember?: boolean;
  proposal?: GovernanceProposal;
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
  createProposal(input: {
    contentReference: string;
    newMinimumRemainingValidity: bigint;
  }): Promise<bigint | undefined>;
  castVote(proposalId: bigint, vote: "against" | "for" | "abstain"): Promise<GovernanceWriteResult | undefined>;
  finalizeProposal(proposalId: bigint): Promise<GovernanceWriteResult | undefined>;
  executeProposal(proposalId: bigint): Promise<GovernanceWriteResult | undefined>;
  performProtectedAction(): Promise<GovernanceWriteResult<bigint> | undefined>;
  refetch(): Promise<unknown>;
}
```

`GovernanceState` describes contract-read readiness only. Check `isVerifiedMember` separately before presenting proposal and vote actions; Solidity repeats the membership check on every write. A member's credential may expire or be revoked between reads and transaction inclusion, so simulation or contract errors remain possible.

The optional `proposalId` parameter requests proposal details, status, vote totals, and the connected wallet's `hasVoted` flag. `readGovernanceProposalIds(client, address, fromBlock, toBlock)` scans `ProposalCreated` events for a caller-supplied range; choose a bounded range and handle provider log limits. Reads are refreshed every 15 seconds and after confirmed writes.

## Typed data

`GovernanceSnapshot` contains:

```ts
{
  votingPeriod: bigint;
  quorum: bigint;
  executionWindow: bigint;
  minimumRemainingValidity: bigint;
  nextProposalId: bigint;
  isVerifiedMember?: boolean;
  protectedActionCount?: bigint;
  proposal?: GovernanceProposal;
}
```

`GovernanceProposal` exposes the proposer, public content reference, start/deadline/execution deadline, proposed policy value, For/Against/Abstain counts, finalized/approved/executed flags, lifecycle state, and `walletHasVoted` when a wallet is connected.

`GovernanceProposalState` values are `pending`, `active`, `succeeded`, `rejected`, `expired`, and `executed`. `GovernanceVoteType` values are `against`, `for`, and `abstain`. No identity or anonymity claim should be attached to a wallet vote.

## Lifecycle and transaction meanings

The hook uses the shared `TransactionLifecycle` states:

| State | Meaning |
| --- | --- |
| `idle` | No action submitted. |
| `simulating` | The exact contract call is being simulated. |
| `awaiting-signature` | Waiting for the wallet. |
| `submitted` | A transaction hash exists. |
| `confirming` | Waiting for a receipt. |
| `confirmed` | Receipt succeeded and the expected contract readback matched. |
| `reverted` | The mined receipt reverted. |
| `rejected` | The wallet rejected the request. |
| `rpc-error` | Simulation/readback/RPC failed, or expected state was not confirmed. |

`GovernanceWriteResult<TResult>` is `{ result: TResult; receipt: TransactionReceipt }`. Cast, finalize, and execute return it with `result: undefined`; the protected action returns its prior action count. A missing result means the receipt or state readback was not confirmed.

On `createProposal`, the hook reads the proposal ID from the `ProposalCreated` receipt event and verifies the stored proposer, content reference, and proposed value. On `castVote`, it confirms `hasVoted`. On finalization, it confirms the proposal is no longer Pending or Active. On execution, it confirms the Executed state and that `minimumRemainingValidity` matches the proposal. On the protected action, it confirms the wallet's action count increased by one.

`createProposal` returns the confirmed proposal ID or `undefined` if a receipt/readback could not confirm it. Other write methods return the shared submission result or `undefined` on a reverted or unconfirmed transaction; thrown wallet/RPC errors are exposed through `transaction.error` and rethrown for caller handling.

## Presentation integration points

The `/dao` route renders the existing DAO workspace and proposal feed. Keep these actions and views distinct:

1. Membership: show `isVerifiedMember` and the detailed `useDojangVerification` status; do not infer membership from a project demo credential.
2. Policy: show `snapshot.minimumRemainingValidity` in seconds or a user-friendly duration.
3. Proposal: collect a public content URI/hash and a bounded new minimum-validity value. Do not put private or personal data in the content reference.
4. Voting: show the three vote totals, quorum, start/deadline, lifecycle state, and `walletHasVoted`.
5. Finalization/execution: make clear these are separate on-chain transactions after voting.
6. Protected action: show the changed policy and action count only after transaction confirmation and readback.

Do not describe votes as private, anonymous, one-person-one-vote, or membership-snapshotted. Proposal creation starts after a one-minute delay. Quorum counts all three vote types; approval requires more For than Against votes. Abstentions count toward quorum but not the approval majority.

## Errors

`GovernanceContractErrorName` covers invalid configuration, invalid proposal IDs, pending/closed voting, duplicate votes, unverified membership, Dojang read failures, finalization/execution timing, unauthorized policy calls, invalid policy bounds, and insufficient credential remaining validity. `explainProtocolError(error)` supplies user-facing English messages for common cases. Keep the original error available for diagnostic logging; never log private data or imply a transaction succeeded after a rejected or failed receipt.

## Deployment status

The ABI and hook are implemented, but the project governance address is not configured or deployed. Until an actual deployment is verified, the hook reports `unconfigured`; do not substitute local fixture or Anvil addresses in a production browser configuration.

## Product-flow handoff for presentation

Use this product hierarchy when adjusting public copy and navigation. It changes presentation priority only; protocol behavior and route availability stay as implemented.

1. **Verified Governance:** `Dojang → DAO`. Dojang is an official, read-only GIWA credential check; DAO membership is enforced against that official trust path. Votes are public.
2. **Private Utility:** `Bojagi-inspired ZK → Lending`. Lending uses its own project-issued policy-2 demo credential and eligibility proof. Do not describe that credential as official Dojang or imply that the `/bojagi` policy-1 Vault proof can be reused for Lending.
3. **Legacy / Secondary Technical Utility:** `Vault`. Keep the existing `/vault` route and protocol accessible as a proof-gated access demonstration; it holds no funds and is not a primary landing journey.

Suggested navigation grouping: `Dojang`, `DAO`; `Bojagi`, `Lending`; then `Vault` under a secondary technical/utilities grouping. Suggested landing summaries: “Verify official membership and participate in governance” and “Prove private demo eligibility for the Lending utility.” Avoid presenting Vault as a flagship card or equal primary journey. Retain a clear note that official Dojang credentials and project-issued ZK demo credentials are distinct trust paths.
