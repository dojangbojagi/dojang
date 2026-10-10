# Frontend Final Integration Map

**Updated:** 2026-10-10  
**Scope:** Current frontend integration contract. DAO proposal discovery and shared chain evidence were added without changing presentation, Solidity, circuits, or deployment state.

## Readiness summary

The shared wallet providers, typed hooks, ABIs, and protocol services exist. The `/dojang`, `/bojagi`, `/vault`, and `/lending` routes already render components connected to those hooks. Most project-contract actions cannot operate against GIWA Sepolia until real project addresses are deployed and configured. DAO now has a bounded, read-only proposal page hook and support in the shared chain evidence service. It still has no route, page component, or navigation entry.

“Ready for presentation integration” means the typed browser interface exists. It does not mean the project contract is deployed, the RPC is currently available, or an external credential has been observed.

| Feature | Integration readiness | Required qualification |
| --- | --- | --- |
| Wallet and network | Ready; shared providers and wallet controls exist. | GIWA Sepolia is the only configured chain. WalletConnect is optional; injected wallets work without a project ID. |
| Official Dojang | Ready for read-only presentation on `/dojang`. | Requires GIWA RPC. No positive personal credential result is established by the repository checkpoint. The demo vault and lending paths do not use this credential. |
| Demo credentials and witness | Ready for presentation; `/dojang` has importer and issuer tools. | Requires the deployed project registry, vault binding, and a wallet authorized by the registry. This is a controlled project demo credential, not Dojang. |
| Bojagi-inspired ZK | Ready for local proof-generation presentation on `/bojagi`. | Requires a matching private witness, active policy-1 demo credential, configured vault address, browser prover assets, and public CRS access. A local proof is not an on-chain verification or transaction. |
| Restricted Vault | Ready for presentation on `/vault`. | Requires deployed registry, verifier, and vault; a matching current proof; and a GIWA Sepolia wallet. The vault is an access flag and holds no funds. |
| Lending | Ready for presentation on `/lending`; the current `LendingWorkspace` already calls the lending hooks. | Requires deployed pool, registry and verifier, an issuer-authorized policy-2 demo credential for borrowing, and actual controlled demo token balances/liquidity. It is not production lending. |
| DAO Governance | Protocol integration surface exists. | Requires a deployed governance address and official Dojang-verified wallets for proposal creation/voting. No `/dao` route or DAO transaction/history evidence adapter exists. |
| Contract evidence | Shared service ready; page integration pending. | The service now reads project code, dependencies, receipts, and bounded logs for configured project contracts, including DAO. The current `/contracts` page still reports configuration only, not verified deployment. |

## Application architecture and route map

`src/app/layout.tsx` wraps the application in `Providers` from `src/components/providers.tsx`. That provider owns one wagmi configuration, one TanStack Query client, RainbowKit, and the in-memory `DemoWitnessProvider`. `src/lib/config/chain.ts` defines GIWA Sepolia, chain ID `91342`, and its explorer. Do not add page-level wallet providers. Use the existing `ConnectButton` through `WalletControl` or the landing navigation.

The current App Router tree has **seven** routes. The older `FRONTEND_INTEGRATION_HANDOFF.md` still describes six routes; `/lending` is now present. `/dao` does not exist, and neither navigation component links to it.

| Route | Current entry and integration | What the final UI should connect or preserve |
| --- | --- | --- |
| `/` | `src/app/page.tsx` renders `LandingPage`. `LandingNav` provides a RainbowKit connect button and links to the current six non-home routes. The landing status helper reads configuration only. | Keep landing presentation and wallet control on the existing provider. Do not label configured-address counts as deployed contracts or application usage. |
| `/dojang` | `src/app/dojang/page.tsx` uses `useWalletNetwork()` and `useDojangVerification(wallet.address)`. `CredentialWitnessImporter` and `DemoCredentialTools` use the separate policy-1 demo credential/witness path. | Keep official Dojang status and project demo credential status visibly separate. Show issuer, UID, schema, expiry and revocation only from the returned record. Issuance/revocation need deployment and role authorization. |
| `/bojagi` | `ProofGenerationPanel` calls `useEligibilityProof()`, `useDemoCredential()`, `useWalletNetwork()`, and the witness context. | Present proof creation and local verification as browser-side eligibility proof work. Do not call it a private transfer, anonymous action, or Solidity verification. |
| `/vault` | `VaultActionPanel` calls `useVaultAccess()`, `useEligibilityProof()`, and `useWalletNetwork()`. | Enter only with a current matching proof on GIWA Sepolia. Show the transaction lifecycle and the `hasAccess` readback; the Vault does not custody or transfer funds. |
| `/lending` | `LendingWorkspace` calls `useLendingMarket()`, `useLendingCredential()`, `useLendingEligibilityProof(witness)`, and `useWalletNetwork()`. It composes supply, borrow, issuer tools, position and transaction panels. | Keep policy-2 demo credential/proof separate from Dojang DAO membership and the policy-1 Vault proof. Use asset decimals from the pool. State the fixed 1:1 demo price, 50% LTV, zero interest, no oracle, no liquidation, and no supplier yield. |
| `/contracts` | `src/app/contracts/page.tsx` reads `projectContracts`, `invalidContractConfig`, official addresses, and the pool's token addresses through `LendingAssetRows`. It does **not** call `inspectProjectDeployment`. Its `PROJECT_CONTRACTS` array still has four entries and omits the configured `daoGovernance` key. | The existing rows mean “address configured / unset / invalid,” not code present or source verified. The shared `inspectProjectDeployment` adapter now provides bytecode/dependency evidence for Claude to connect in a presentation-only change. Do not claim deployment from an environment value. |
| `/docs` | Static explanation plus a count of nonempty `projectContracts` config values. | Make clear that a configuration count is not deployment evidence. The page does not read the DAO hook or on-chain evidence service. |
| `/dao` (recommended) | No route, page, DAO presentation component, or navigation entry exists. | Recommend a dedicated route for proposal discovery, membership, voting and execution. This audit does not create it; agree route and presentation scope before Claude adds it. |

## Wallet, config, and trust boundary

### Wallet

Import `useWalletNetwork` from `@/hooks/use-wallet-network`. It spreads wagmi `useAccount()` fields and adds:

```ts
{
  state: WalletState; // "disconnected" | "connecting" | "connected" | "wrong-network"
  isGiwaSepolia: boolean;
  switchToGiwaSepolia: () => Promise<unknown>;
  isSwitching: boolean;
}
```

The `address`, `chainId`, and connection fields are wagmi account values. `state: "connected"` means the account chain ID is `91342`; it does not mean a contract is deployed or the wallet is eligible.

### Environment and addresses

`src/lib/config/env.ts` parses these optional public settings:

- `NEXT_PUBLIC_GIWA_RPC_URL` (defaults to the documented GIWA Sepolia RPC; it may be rate-limited).
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (optional; otherwise injected connector only).
- `NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT`.
- `NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT` (the project adapter address).
- `NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT`.
- `NEXT_PUBLIC_LENDING_POOL_CONTRACT`.
- `NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT`.

`GIWA_RPC_URL` is parsed separately by `src/lib/config/server-env.ts` for server-only use. Browser hooks use the public RPC. `src/lib/config/contracts.ts` exports `projectContracts` and `invalidContractConfig`; `checkedAddress()` drops malformed address strings. A valid-looking configured address still does not prove there is bytecode at that address.

Official `DojangScroll`, `DojangAttesterBook`, and EAS addresses, the Upbit Korea attester ID, and Verified Address schema UID are constants in `officialDojang`. They are external GIWA infrastructure, not project contracts. The Dojang hook resolves the trusted issuer from the current `DojangAttesterBook.getAttester(attesterId)` read. DAO Solidity checks that same official trust path. Do not substitute the demo registry for it.

The project-owned inventory is `DemoCredentialRegistry`, `ZKTranscriptLib`, `RelationsLib`, `HonkVerifier`, `EligibilityVerifierAdapter`, `RestrictedVault`, two `ControlledTestToken` assets, `LendingPool`, and `GovernedDojangAccess`. The pool exposes its token addresses; they are not separately configured. GIWA Sepolia, Dojang/EAS, and the explorer are external infrastructure. Bojagi is a conceptual privacy reference; this project does not implement its private-transfer protocol.

## Exact hook and input/return map

The canonical state types live in `src/lib/protocol/types.ts`. Amounts and protocol counters are usually `bigint`; format ERC-20 amounts with the asset's `decimals`. Do not coerce balances or large counters to JavaScript `number` for arithmetic.

### Official Dojang and demo credentials

**`useDojangVerification(wallet?: \`0x${string}\`)`** from `@/hooks/use-dojang-verification` returns:

```ts
{
  state: DojangState; // idle | checking | official-verified | no-official-credential |
                     // invalid | expired | revoked | read-error
  credential?: OfficialDojangCredential; // wallet, issuer, attestationUid, issuedAt,
                                         // expirationTime, revocationTime, schemaUid,
                                         // isValid, isVerified
  isLoading: boolean;
  error?: Error;
  refetch: () => Promise<unknown>;
}
```

It reads `isVerified`, a UID only after a positive status, the current trusted attester, EAS attestation details, and EAS validity. `no-official-credential` follows a successful negative `isVerified` read. RPC errors or invalid/mismatched attestation structure must not be rendered as “unverified.” The current UI hook is read-only. `useDaoGovernance().isVerifiedMember` is the DAO contract's authorization read; the detailed Dojang hook is for credential presentation and is not a client-side authorization bypass.

**`useDemoCredential(walletOverride?: \`0x${string}\`)`** reads registry policy `1` and returns `state: DemoCredentialState`, optional `record: DemoCredentialRecord`, `error`, `refetch`, and `hasRegistry`. States: `disconnected | unconfigured | checking | missing | active | expired | revoked | read-error`.

**`useDemoCredentialIssuance()`** returns `issueCredential(input): Promise<DemoCredentialWitness>`, `transaction: TransactionLifecycle`, and `isSubmitting`. Input is:

```ts
{ wallet: Address; privateValue: string; expiresAt: bigint }
```

It issues only policy `1`, uses the configured vault in the commitment, simulates then submits `recordCredential`, and returns the witness only after receipt and registry readback. The issuer role is enforced by the contract; authorization failure may arise during simulation. The witness is private data:

```ts
{ format: "giwa-demo-credential-v1"; wallet: Address; policyId: number;
  commitment: Hex; privateValue: string; salt: Hex; expiresAt: number }
```

Keep it in memory or use an explicitly designed secure transfer. Never log, upload, put it in a URL, or send it to analytics. `expiresAt` on the witness is a safe-integer Unix timestamp in seconds; the registry record uses `bigint`.

**`useDemoCredentialRevocation(walletOverride?: Address)`** returns `state`, optional `record`, `revokeCredential(): Promise<void>`, `transaction`, `isSubmitting`, and `refetch`. It revokes policy `1`; the issuing wallet or registry admin must be authorized by the contract. Both issuer actions are unavailable until the registry is deployed/configured; issuance also requires the vault address.

The witness importer validates the JSON format and compares wallet, policy, commitment and expiry against the current record. `DemoWitnessProvider` keeps imported witness/proof state in React memory, not persistent storage.

### ZK proof and Vault

**`useEligibilityProof()`** from `@/hooks/use-eligibility-proof` returns:

```ts
{
  state: ProofState; // credential-required | ready-to-prove | generating | invalid |
                     // ready-to-submit | contract-unconfigured
  witnessMatchesRecord: boolean;
  proof?: EligibilityProof;
  generateProof: () => Promise<EligibilityProof>;
  error?: string;
}
```

`EligibilityProof` carries proof bytes, exactly nine public inputs, `publicContext`, `createdAt: number`, and `localVerification: "verified" | "not-run"`. The policy-1 context binds wallet, commitment/version/expiry, chain `91342`, threshold `1_000`, and the configured RestrictedVault address. `ready-to-submit` means the browser proof is locally verified and current; it is not an on-chain verifier result. Prover setup loads `/circuits/private_eligibility.json` and public CRS data. The private witness stays in the browser.

**`useVaultAccess()`** from `@/hooks/use-vault-access` returns `state: VaultState`, `hasAccess: boolean`, optional `threshold: bigint`, `transaction`, `enterVault(proof: EligibilityProof): Promise<void>`, `refetch`, and `isSubmitting`. It reads `hasAccess` and threshold. `enterVault` checks the proof context/public input tuple, simulates the call, writes it, waits for a receipt, and reads access back. The state values are `unconfigured | disconnected | checking | locked | eligible | access-granted | previously-granted | read-error`.

**Transaction caveat:** on a successful receipt with a false/missing Vault access readback, `useVaultAccess` currently sets `transaction.state` to `"confirmed"` with `transaction.error` populated, then returns. It can also return after an on-chain revert with state `"reverted"`. Do not treat promise resolution or `state === "confirmed"` alone as access; require `hasAccess === true`, an access state from the contract read, and no transaction error. `useDemoCredentialIssuance` likewise can retain `confirmed` plus an error when its version readback detects a changed credential, and it throws without returning the witness. These behaviors are present in source and are not changed by this handoff.

### Lending

Lending is separate from DAO membership and Vault policy. It uses registry policy `2`, version `1`, threshold `1_000`, and LendingPool as the proof target. It is backed by controlled test tokens, not real-market assets.

**`useLendingCredential(walletOverride?: Address)`** returns `state: LendingCredentialState`, optional `record`, `issuerAuthorized: boolean`, optional read `error`, `refetch`, and `hasRegistry`. States: `unconfigured | disconnected | checking | missing | active | expired | revoked | issuer-untrusted | read-error`. `active` requires unexpired/unrevoked policy-2 record and a current `ISSUER_ROLE` read for its issuer.

**`useLendingCredentialIssuance()`** returns `issueCredential(input): Promise<DemoCredentialWitness>`, `transaction`, and `isSubmitting`. Input is `{ wallet: Address; privateValue: string; expiresAt: bigint }`. It issues a policy-2 record bound to the configured LendingPool. The connected wallet must have the registry's issuer role; no Dojang credential is used for this.

**`useLendingEligibilityProof(witness?: DemoCredentialWitness)`** returns `state: LendingProofState`, optional `proof: EligibilityProof`, optional `error: string`, and `generateProof(witnessOverride?: DemoCredentialWitness): Promise<EligibilityProof>`. States include `unconfigured`, `disconnected`, `wrong-network`, `checking-credential`, credential/issuer/witness-required states, `ready-to-prove`, `generating`, `proof-ready`, and `invalid`. `proof-ready` means local verification only; Solidity verifies it again during borrow.

**`useLendingMarket()`** returns:

```ts
{
  state: LendingMarketState; // unconfigured | disconnected | wrong-network |
                             // checking | ready | read-error
  summary?: LendingMarketSummary; // lendingAsset/collateralAsset { address, symbol, decimals },
                                  // availableLiquidity, totalSupplierLiquidity, totalDebt
  position?: LendingUserPosition; // token balances/allowances, supplier position, collateral,
                                  // collateral value, debt, capacity, remaining capacity
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
  refetch: () => Promise<void>;
  approveLendingAsset(amount: bigint): Promise<void>;
  approveCollateralAsset(amount: bigint): Promise<void>;
  supply(amount: bigint): Promise<void>;
  withdrawSupply(amount: bigint): Promise<void>;
  depositCollateral(amount: bigint): Promise<void>;
  withdrawCollateral(amount: bigint): Promise<void>;
  borrow(amount: bigint, proof: EligibilityProof): Promise<void>;
  repay(amount: bigint): Promise<void>;
}
```

Token amounts are base units; use `summary.lendingAsset.decimals` or `summary.collateralAsset.decimals` for parsing/formatting. The market hook has no separate `error` field; display its `read-error` state and any `transaction.error`. Writes are simulated, submitted, receipt-checked and readback-checked. Borrowing also checks policy-2 witness/proof context and contract eligibility. The UI must not mint tokens or imply yield/production credit.

### DAO Governance

**`useDaoGovernance(proposalId?: bigint)`** from `@/hooks/use-dao-governance` returns `state: GovernanceState`, optional `snapshot: GovernanceSnapshot`, query `error`, `isLoading`, optional `isVerifiedMember`, optional `proposal`, `transaction`, `isSubmitting`, `refetch`, and:

```ts
createProposal(input: {
  contentReference: string;
  newMinimumRemainingValidity: bigint;
}): Promise<bigint | undefined>;
castVote(proposalId: bigint, vote: "against" | "for" | "abstain"): Promise<GovernanceWriteResult<undefined> | undefined>;
finalizeProposal(proposalId: bigint): Promise<GovernanceWriteResult<undefined> | undefined>;
executeProposal(proposalId: bigint): Promise<GovernanceWriteResult<undefined> | undefined>;
performProtectedAction(): Promise<GovernanceWriteResult<bigint> | undefined>;
```

`GovernanceWriteResult<T>` is `{ result: T; receipt: TransactionReceipt }`. `createProposal` returns a confirmed proposal ID or `undefined`; the other writes return a receipt result only after their specific readback succeeds. The proposal content reference is public and must be 1–512 bytes; do not put personal/private data in it. The value is a proposed `minimumRemainingValidity` in seconds, bounded by the contract to `0..365 days`.

`GovernanceSnapshot` contains `votingPeriod`, `quorum`, `executionWindow`, `minimumRemainingValidity`, `nextProposalId`, optional `isVerifiedMember`, optional `protectedActionCount`, and optional one-proposal detail. `GovernanceProposal` contains ID, proposer, content reference, timestamps, proposed policy, For/Against/Abstain counts, finalized/approved/executed flags, state, and optional `walletHasVoted`. State values are `pending | active | succeeded | rejected | expired | executed`.

Important presentation distinctions:

- `state: "ready"` means the configured governance reads completed; it is not membership. Check `isVerifiedMember` separately and show wallet/network state from `useWalletNetwork()`.
- Solidity rechecks the official Dojang credential at proposal creation and voting. A client-side membership read must never grant authorization by itself.
- Membership is one eligible wallet per proposal, not one person per proposal. Votes are public, not private or anonymous. Do not claim membership snapshots.
- The action changes only the governance contract's own minimum-remaining-validity policy, consumed by its protected action. It does not change RestrictedVault's ZK threshold or LendingPool parameters.
- `finalizeProposal` and `executeProposal` are separate transactions. The contract allows any caller when lifecycle requirements are met; membership is required for proposal creation/voting, not for finalization/execution.

The read service at `@/lib/governance/service` also exposes a complete on-chain proposal page interface:

```ts
import { readGovernanceProposalPage } from "@/lib/governance/service";
import type { GovernanceProposalPageResult } from "@/lib/protocol/types";

readGovernanceProposalPage(
  client: PublicClient,
  address: Address,
  input?: { beforeId?: bigint; pageSize?: number; wallet?: Address },
): Promise<GovernanceProposalPageResult>
```

The returned types are:

```ts
import type { GovernanceProposal } from "@/lib/protocol/types";

interface GovernanceProposalPage {
  proposals: readonly GovernanceProposal[];
  totalProposals: bigint;
  nextCursor?: bigint;
  votingPeriod: bigint;
  quorum: bigint;
  executionWindow: bigint;
  minimumRemainingValidity: bigint;
}

type GovernanceProposalPageResult =
  | { state: "ready"; page: GovernanceProposalPage }
  | { state: "no-code" };
```

`GovernanceProposalPageResult` from `@/lib/protocol/types` is either `{ state: "no-code" }` or `{ state: "ready"; page: GovernanceProposalPage }`. A ready page contains `proposals: readonly GovernanceProposal[]`, `totalProposals: bigint`, optional `nextCursor: bigint`, `votingPeriod`, `quorum`, `executionWindow`, and `minimumRemainingValidity`. Proposal details include lifecycle state and For/Against/Abstain totals. IDs come from the contract's monotonic `nextProposalId`, and each detail is read from the contract; no proposal, vote, or total is synthesized. Results are newest first. `beforeId` is exclusive: pass the prior page's `nextCursor` as the next call's `beforeId`. Page size defaults to 20 and is capped at 50; proposal detail reads use bounded concurrency. An empty deployed contract returns `state: "ready"`, an empty `proposals` array, and `totalProposals: 0n`.

**`useDaoProposalFeed(input?: { beforeId?: bigint; pageSize?: number })`** from `@/hooks/use-dao-proposal-feed` wraps that service and returns:

```ts
{
  state: GovernanceProposalFeedState; // unconfigured | checking | ready | no-code | read-error
  page?: GovernanceProposalPage;
  proposals: readonly GovernanceProposal[];
  totalProposals?: bigint;
  nextCursor?: bigint;
  quorum?: bigint;
  votingPeriod?: bigint;
  executionWindow?: bigint;
  minimumRemainingValidity?: bigint;
  error?: Error;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}
```

`unconfigured` means no valid DAO address is configured; `checking` means the query is pending; `no-code` means the configured address has no runtime bytecode; `read-error` includes RPC failures and a non-GIWA chain response. Only `ready` means the page and configuration reads completed. The hook polls every 15 seconds and its query is invalidated after a confirmed DAO write. `walletHasVoted` is populated only when the connected wallet is available; membership authorization remains a separate contract read and is enforced again by Solidity on writes.

The event-oriented helper is:

```ts
readGovernanceSnapshot(
  client: PublicClient, address: Address, wallet?: Address, proposalId?: bigint,
): Promise<GovernanceSnapshot>

readGovernanceProposalIds(
  client: PublicClient, address: Address, fromBlock: bigint, toBlock: bigint,
  blockChunkSize?: bigint,
): Promise<bigint[]>
```

`readGovernanceProposalIds` scans `ProposalCreated` in chunks (default 1,000 blocks, maximum 10,000 per request) and rejects a total range over 100,000 blocks. It rejects non-GIWA chain IDs and returns sorted, unique on-chain event IDs; it is optional event evidence, not the feed source. A real deployment block is useful when requesting event history. `useWalletNetwork()` remains the source of wallet/network state; the feed reads through the GIWA-configured public client and never submits a transaction.

## Transaction lifecycle and error display

`TransactionLifecycle` from `@/lib/protocol/types` is:

```ts
type TransactionState =
  | "idle" | "simulating" | "awaiting-signature" | "submitted" | "confirming"
  | "confirmed" | "reverted" | "rejected" | "rpc-error";

interface TransactionLifecycle {
  state: TransactionState;
  hash?: Hex;
  explorerUrl?: string;
  error?: string;
}
```

Use `explainProtocolError(error)` from `@/lib/protocol/errors` for UI copy. `ProtocolError` exposes a typed `code` and message; contract custom error names are mapped from the original viem error text. Catch action promises, retain the lifecycle's `hash`/`explorerUrl` for submitted transactions, and render a successful action only after receipt and the relevant contract readback. A transaction hash alone is not success. Keep diagnostics separate from the user message and never expose private witness data.

## Contract evidence interfaces and limitations

`src/lib/protocol/chain-evidence.ts` exports:

- `inspectProjectDeployment(client: PublicClient): Promise<ProjectDeploymentEvidence>` — requires chain ID `91342`, checks configured registry/adapter/vault/pool/**DAO** runtime code and hashes, and reads their supported dependency links. It discovers HonkVerifier and lending/collateral asset code. DAO dependency readback includes its DojangScroll, DojangAttesterBook, and EAS getter addresses plus whether each matches the official configured address. Those are external infrastructure, not project-owned contracts. A code hash is not source verification.
- `readProjectTransactionEvidence(client, hash): Promise<ProjectTransactionEvidence>` — reads the actual receipt, returns a GIWA explorer transaction URL, and filters logs to configured project contracts, including DAO. Matching event records also carry their transaction explorer URL.
- `readProjectProtocolLogs(client, { fromBlock, toBlock, blockChunkSize? }): Promise<readonly ProjectEventLog[]>` — scans logs for configured project contracts and discovered lending assets in chunks of at most 10,000 blocks. Each call is limited to a total 100,000-block range; split wider history into bounded calls.
- `protocolEventAbi(contract)` — returns the ABI for registry, **DAO governance**, vault, pool, and token events; it returns `undefined` for `honkVerifier`.

The explorer URLs use the configured GIWA Sepolia explorer base with the actual address or receipt hash. They are links to public records, not source-verification claims. Contract entries with a configured or discovered address link to that address even when code is absent; check `codeState` before describing a deployment.

The exported evidence contract types are in `@/lib/protocol/chain-evidence`:

```ts
import {
  inspectProjectDeployment,
  readProjectProtocolLogs,
  readProjectTransactionEvidence,
  protocolEventAbi,
} from "@/lib/protocol/chain-evidence";
import type {
  ContractCodeEvidence,
  ContractDependencyEvidence,
  EvidenceContractName,
  ProjectDeploymentEvidence,
  ProjectEventLog,
  ProjectTransactionEvidence,
} from "@/lib/protocol/chain-evidence";
```

Those exported types have these shapes:

```ts
import type { Address, Hash, Hex, PublicClient } from "viem";

type EvidenceContractName =
  | "credentialRegistry" | "proofVerifier" | "restrictedVault" | "lendingPool"
  | "daoGovernance" | "honkVerifier" | "lendingAsset" | "collateralAsset";

interface ContractCodeEvidence {
  name: EvidenceContractName;
  address?: Address;
  configuredBy: "environment" | "on-chain" | "unconfigured";
  codeState: "unconfigured" | "no-code" | "present";
  runtimeCodeHash?: Hex;
  explorerUrl?: string;
}

interface ContractDependencyEvidence {
  from: "proofVerifier" | "restrictedVault" | "lendingPool" | "daoGovernance";
  relation: "honkVerifier" | "registry" | "verifier" | "lendingAsset" | "collateralAsset"
    | "dojangScroll" | "attesterBook" | "eas";
  address: Address;
  matchesConfiguredAddress?: boolean;
}

interface ProjectDeploymentEvidence {
  chainId: number;
  contracts: readonly ContractCodeEvidence[];
  dependencies: readonly ContractDependencyEvidence[];
  discoveryWarnings: readonly {
    contract: EvidenceContractName;
    reason: "read-failed";
  }[];
}

interface ProjectEventLog {
  contract: EvidenceContractName;
  address: Address;
  blockNumber: bigint | null;
  transactionHash: Hash | null;
  transactionIndex: number | null;
  logIndex: number | null;
  topics: readonly Hex[];
  data: Hex;
  explorerUrl?: string;
}

interface ProjectTransactionEvidence {
  chainId: number;
  transactionHash: Hash;
  blockNumber: bigint;
  from: Address;
  to: Address | null;
  status: "success" | "reverted";
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  explorerUrl: string;
  projectEvents: readonly ProjectEventLog[];
}
```

Call signatures and failure behavior:

```ts
inspectProjectDeployment(client: PublicClient): Promise<ProjectDeploymentEvidence>
readProjectTransactionEvidence(client: PublicClient, hash: Hash): Promise<ProjectTransactionEvidence>
readProjectProtocolLogs(
  client: PublicClient,
  input: { fromBlock: bigint; toBlock: bigint; blockChunkSize?: bigint },
): Promise<readonly ProjectEventLog[]>
protocolEventAbi(contract: EvidenceContractName)
```

All three evidence functions reject a non-GIWA chain ID with `ProtocolError` and reject RPC failures rather than converting them to zero/empty evidence. A failure reading a supported contract dependency is retained as `{ contract, reason: "read-failed" }` in `discoveryWarnings`; it does not create a positive dependency claim. Call these through the shared configured GIWA Sepolia client. Chain ID alone cannot prove that an arbitrary endpoint is not a local Anvil instance configured with ID `91342`; local receipts must remain on their separate local-test path and must never be passed off as GIWA evidence.

Current limitations to preserve in the handoff:

1. `/contracts` does not yet call `inspectProjectDeployment` or present chain evidence. Its current configured-address rows are not code-present or source-verified claims.
2. No source-verification result interface or verified-source claim is exposed. Explorer links are navigation to public records, not proof that source verification passed.
3. Read services require a working GIWA Sepolia RPC; chain evidence rejects another chain ID. RPC failure remains a read error, not an empty/zero protocol statistic. Proposal-feed errors are exposed as `read-error` by `useDaoProposalFeed`.

For UI usage/evidence counts, scan only project-owned contract events and state. Never use GIWA-wide explorer transaction/address/gas totals as application activity.

## Real, local, demo, and unavailable states

| Item | What can truthfully be shown |
| --- | --- |
| GIWA Sepolia / Dojang / EAS | External network and attestation infrastructure. Dojang results are live reads only when RPC queries succeed. No positive user credential is established by this repository checkpoint. |
| Project-owned contract deployments | None are recorded on GIWA Sepolia; project addresses are not supplied by source defaults. Keep contract actions unconfigured until real addresses and code/readback are confirmed. |
| Local Foundry/Anvil | Local-only test/deployment evidence. It must not be linked or described as a GIWA transaction. See the validation record below for the current command result; earlier test counts are historical. |
| Demo credential issuer | Project-owned synthetic commitment path, requiring an authorized registry issuer after deployment. It is not Dojang, identity verification, or a real balance attestation. |
| ZK proof | Browser-local proof generation and verification before submission. Solidity re-verifies on protected actions. No private transfer, hidden wallet, or private/anonymous vote is implemented. |
| Lending | Controlled test tokens and a fixed demo market after deployment/configuration. No real assets, oracle, yield, interest, liquidation, or production credit. |
| DAO | Official Dojang membership checks and governed calls are implemented in Solidity and local tests, but the address is unconfigured/un-deployed. No GIWA proposal, vote, or execution may be claimed. |
| Explorer evidence | Use an actual configured project contract address and actual receipt. Runtime code/readback does not equal source verification; network totals are not protocol usage. |

## Integration gaps and checkpoint caveats

- No DAO route/component/nav item exists. The typed `useDaoProposalFeed` hook is ready for presentation integration without a DAO page being implemented here.
- DAO contract code, dependency, receipt, log, and event-ABI evidence are available through the shared adapter. The Contracts page does not yet consume that evidence.
- Contract page status is configuration-only. `inspectProjectDeployment()` exists for code and dependency evidence but is not wired into that page.
- The app has separate wallet, credential, proof, Vault, Lending, and DAO state hooks, but no single normalized “all protocol readiness” interface. Compose the existing states in presentation; do not invent a universal success state.
- `useLendingMarket()` returns `read-error` without an `error` field. `useVaultAccess()` exposes read errors through `state`; action errors are in `transaction.error` or thrown. Show the available state/message rather than relying on a missing hook property.
- Older handoff documents may still contain historical route and test counts. Use the validation record below for this checkpoint; do not infer a current test count from those documents.
- `src/app/contracts/page.tsx` identifies four static project-contract rows while `projectContracts` contains five configured keys including DAO. The discrepancy affects display counts; the current page does not claim bytecode verification, but it is incomplete for the DAO inventory.

## Recommended integration order

1. Keep the existing root provider and RainbowKit wallet control. Render `useWalletNetwork()` state and wrong-network action consistently.
2. Connect `/dojang` to official Dojang read state and detail; keep `useDemoCredential`/issuer/witness controls in a clearly separate demo section.
3. On `/bojagi`, display witness-match and `ready-to-submit` as local proof status only. Keep private value/salt in browser memory and never send them to telemetry.
4. On `/vault`, enable entry only with GIWA wallet, configured deployment, current local proof and no write in flight. Treat access as successful only after receipt and `hasAccess` readback.
5. Keep `/lending` on `LendingWorkspace` and its hooks. Gate borrow on current policy-2 credential, witness, local proof, collateral and market reads. Use explicit approvals and show every receipt/readback state.
6. For `/contracts`, distinguish address configuration, code present, dependency readback, receipt evidence, and source verification. The existing page does not yet consume `inspectProjectDeployment` or DAO evidence.
7. If adding a DAO route is in scope, use `useDaoProposalFeed({ beforeId, pageSize })` for proposal discovery and `useDaoGovernance(id)` for membership/actions. Use `useDojangVerification` for credential detail. Show quorum/timing and For/Against/Abstain; make voting/public membership semantics explicit. Do not use Lending credentials or ZK proofs for DAO authorization.
8. Keep `/docs` and all visual routes honest about no GIWA deployment, local-only evidence, demo issuer boundaries, and external GIWA infrastructure.

## File ownership boundary

Claude owns presentation: `src/app/**/page.tsx`, presentation-only components, and styles/animations. Claude may call the existing hooks and services from client components and adapt markup, but must keep status meanings and types intact. `src/components/providers.tsx`, `src/components/witness-context.tsx`, `src/hooks/**`, `src/lib/**`, contract ABIs/config, Solidity contracts, and circuits are protocol/integration-owned. Do not duplicate providers, credentials, proof verification, wallet authorization, contract writes, or readback logic in page code. Request a separate protocol change if an interface is insufficient; this handoff does not authorize such a change.

## Validation record

- `bun run typecheck` — passed.
- `bun run build` — passed; Next.js generated the existing seven routes (`/`, `/bojagi`, `/contracts`, `/docs`, `/dojang`, `/lending`, `/vault`).
- `bun run contracts:test` — 60 passed, 0 failed, 0 skipped across four Foundry suites, including 16 governance tests. Foundry emitted a non-fatal warning that it could not write its external signature cache under the workspace permission boundary.

These are local validation results, not GIWA Sepolia deployment or transaction evidence.

