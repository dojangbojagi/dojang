# Lending V2 Frontend Integration Handoff

This handoff describes the nonvisual Lending V2 interfaces available to UI components. It does not authorize changes to the V1 Lending path, DAO, protocol contracts, circuits, wallet providers, or security behavior.

## Deployment and credential status

- Lending V2 is project-owned code, but it is **not deployed** to GIWA Sepolia. The V2 pool, oracle, verifier adapter, and test tokens have only been exercised in local Anvil workflows.
- GIWA Sepolia is chain `91342`. Configure `NEXT_PUBLIC_LENDING_V2_POOL_CONTRACT` only after a real compatible V2 deployment. The hook checks the network, pool bytecode, policy constants, dependency bytecode, and configured registry before enabling use.
- The current policy is policy `3`, version `1`, with threshold `1000`. V1 policy `2` remains separate; a V1 proof cannot authorize a V2 action.
- The implemented proof path consumes the project's policy-3 credential record and its matching private witness. The UI must call it **Project Test Credential**. It is not an official Dojang credential or proof of an official Dojang balance. Access to official Dojang private balance witnesses remains unavailable/unconfirmed; do not describe this path as official Dojang-backed lending.
- A proof is locally verified by the existing browser prover and bound to the connected wallet, credential commitment/version/expiry, GIWA chain ID, V2 policy, and exact V2 pool address. The contract remains the final verifier and authorization boundary.

## Import paths

```ts
import { useLendingMarketV2 } from "@/hooks/use-lending-market-v2";
import { useLendingV2EligibilityProof } from "@/hooks/use-lending-v2-eligibility-proof";
import { useLendingV2CredentialIssuance } from "@/hooks/use-lending-v2-credential-issuance";
import {
  readLendingV2Deployment,
  readLendingV2Credential,
  readLendingV2Market,
  type LendingV2MarketSnapshot,
} from "@/lib/lending/v2-service";
import {
  lendingV2DeploymentQueryKey,
  lendingV2CredentialQueryKey,
  lendingV2MarketQueryKey,
} from "@/lib/lending/v2-config";
import { mapLendingV2Error } from "@/lib/lending/v2-errors";
```

## Read service contracts

The service accepts a viem `PublicClient` and uses block-pinned reads for a consistent market snapshot.

```ts
readLendingV2Deployment(
  client: PublicClient,
  pool: Address,
  expectedRegistry?: Address,
  readAtBlock?: bigint,
): Promise<{
  pool: Address;
  credentialRegistry: Address;
  eligibilityVerifier: Address;
  oracle: Address;
  policyId: bigint;
  policyVersion: bigint;
  threshold: bigint;
}>;

readLendingV2Credential(
  client: PublicClient,
  registry: Address,
  wallet: Address,
): Promise<LendingV2CredentialSnapshot>;

readLendingV2Market(
  client: PublicClient,
  input: { pool: Address; wallet?: Address; expectedRegistry?: Address },
): Promise<LendingV2MarketSnapshot>;
```

`LendingV2CredentialSnapshot` has `state: "missing" | "active" | "expired" | "revoked" | "not-yet-valid" | "issuer-untrusted"`, optional `record`, and `issuerAuthorized`. The record contains the wallet, commitment, issuer, issue/expiry times, version, and revoked flag.

`LendingV2MarketSnapshot` contains the pool and dependency addresses, policy values, `blockNumber`, `blockTimestamp`, `riskPaused`, reserve snapshots, and an optional wallet position. Each reserve includes asset, symbol, verified token decimals, reserve config/data, oracle status, optional user position, and optional `maxBorrowable`. Position data includes supplied balance, collateral, debt, collateral-enabled status, wallet balance, allowance, and optional WAD valuations. Account data includes collateral/debt values, LTV capacity, current LTV, health factor, and liquidation eligibility when pricing is safe to compute.

Oracle status is `"fresh" | "missing" | "stale" | "future" | "unavailable"`. A broken or stale oracle does not hide reserve or debt reads; risk metrics are marked `blocked-by-oracle`, and no max borrow figure is supplied unless the required prices are fresh. Contract simulation remains authoritative for writes.

## Hook contracts and UI states

### `useLendingMarketV2()`

Returns:

```ts
{
  state: LendingV2MarketState;
  snapshot?: LendingV2MarketSnapshot;
  transaction: TransactionLifecycle;
  failure?: LendingV2Failure;
  isSubmitting: boolean;
  readAvailable: boolean;
  writesAvailable: boolean;
  refetch(): Promise<void>;
  inspectPosition(wallet: Address): Promise<LendingV2MarketSnapshot["position"]>;
  approveToken(asset: Address, amount: bigint): Promise<void>;
  supply(asset: Address, amount: bigint, proof: EligibilityProof): Promise<void>;
  withdrawSupply(asset: Address, amount: bigint): Promise<void>;
  depositCollateral(asset: Address, amount: bigint): Promise<void>;
  enableCollateral(asset: Address, proof: EligibilityProof): Promise<void>;
  disableCollateral(asset: Address): Promise<void>;
  withdrawCollateral(asset: Address, amount: bigint): Promise<void>;
  borrow(asset: Address, amount: bigint, proof: EligibilityProof): Promise<void>;
  repay(asset: Address, amount: bigint): Promise<void>;
  liquidate(borrower: Address, debtAsset: Address, collateralAsset: Address, requestedRepay: bigint): Promise<void>;
}
```

`state` is `"unconfigured" | "disconnected" | "wrong-network" | "checking" | "unavailable" | "read-error" | "ready"`. `readAvailable` means a compatible deployment snapshot was read. `writesAvailable` additionally requires a connected GIWA Sepolia wallet and compatible deployment. No writes can proceed when the pool is unset or fails deployment checks.

Proof-required supply, collateral activation, and borrowing require a fresh V2 proof and an active policy-3 credential from a currently authorized issuer. Repayment and safe exit operations do not require a fresh proof. Amounts are raw token units. Approvals are separate wallet transactions.

### `useLendingV2EligibilityProof(witness?)`

The optional argument is `DemoCredentialWitness`; the same type may be passed to `generateProof(witnessOverride?)`.

Returns `{ state, credentialLabel, credential, proof, verificationStatus, error, generateProof, refetchCredential }`, where:

- `state`: `"unconfigured" | "disconnected" | "wrong-network" | "checking" | "unavailable" | "read-error" | "credential-required" | "credential-expired" | "credential-revoked" | "credential-not-yet-valid" | "issuer-untrusted" | "witness-required" | "witness-mismatch" | "ready-to-prove" | "generating" | "proof-ready" | "invalid"`.
- `credentialLabel` is always `"Project Test Credential"`.
- `proof` is present only after local verification and complete policy-3 / wallet / commitment / expiry / chain / pool context checks.
- `verificationStatus` is `"not-generated" | "locally-verified"`. This reports local prover verification, not official Dojang verification or on-chain transaction success.
- `generateProof(witnessOverride?)` returns `Promise<EligibilityProof>` or throws if the credential, witness, wallet, deployment, or proof is invalid.
- `refetchCredential()` re-reads the current policy-3 registry record.

The witness contains private eligibility input and salt. Keep it client-side and handle it as sensitive user data. Do not log it, put it in a URL, or label it an official Dojang witness.

### `useLendingV2CredentialIssuance()`

Returns `{ credentialLabel, transaction, isSubmitting, issueCredential }`. The method is:

```ts
issueCredential(input: {
  wallet: Address;
  privateValue: string;
  expiresAt: bigint;
}): Promise<DemoCredentialWitness>
```

It is a **project test credential issuer** path, gated by the configured project registry's on-chain issuer role. It checks deployment, policy threshold, wallet/network, issuer authorization, expiry, and credential readback after the receipt. It must never be represented as official Dojang issuance. The returned witness includes private value and salt and is sensitive.

## Numeric units and display

- Token amounts and `maxBorrowable`: raw ERC-20 base units; use each reserve's on-chain `decimals` for formatting.
- Oracle prices and account valuation fields ending in `Wad`: 18-decimal WAD.
- LTV/interest parameters ending in `Bps`: basis points (10,000 = 100%). Utilization and current rates returned from reserve data are `bigint` basis points.
- Liquidity/borrow indices and health factor use RAY scale (`10^27`). The `healthFactorWad` ABI field name is retained; V2 comparison uses the RAY threshold exported as `LENDING_V2_RAY`.
- ABI `uint8`/`uint16` values are JavaScript `number`; wider integer values are `bigint`.
- Current ABI reads provide projected reserve totals and the wallet's projected position after index accrual. It does not expose enough user checkpoint data to derive and display a separate per-user accrued-interest delta. Do not fabricate one.

## Transactions and errors

The existing `TransactionLifecycle` states used by the hook are `idle`, `simulating`, `awaiting-signature`, `submitted`, `confirming`, `confirmed`, `reverted`, `rejected`, and `rpc-error`. A simulation or validation failure is reported before submission with no hash. A wallet rejection is `rejected`. `confirmed` is set only after a successful receipt and operation-specific event/state readback. GIWA transaction explorer links are attached only after a real wallet submission. Confirmed operations invalidate and refresh the market query.

`LendingV2Failure` is `{ category, code, message }`. Categories are `configuration`, `wallet`, `eligibility`, `oracle`, `cap`, `liquidity`, `health`, `reserve`, `allowance`, `balance`, `liquidation`, `paused`, `rpc`, and `unknown`. `mapLendingV2Error(error: unknown): LendingV2Failure` maps known contract errors and RPC/wallet failures. Preserve the category/state in UI; do not turn failures into success states.

Query key helpers return BigInt-free serializable keys:

```ts
lendingV2MarketQueryKey(pool?: Address, wallet?: Address)
lendingV2DeploymentQueryKey(pool?: Address)
lendingV2CredentialQueryKey(registry?: Address, wallet?: Address)
```

## Suggested component integration points

The page/presentation layer can consume these hooks without knowing ABI details:

1. Market/position summary: `useLendingMarketV2().snapshot`, `state`, and `refetch`.
2. Reserve cards and borrow limits: `snapshot.reserves`; show oracle state and omit risk totals/max borrow when unavailable.
3. Credential status panel: `useLendingV2EligibilityProof(witness)`; clearly label all project-issued records and proofs.
4. Local credential demo controls: `useLendingV2CredentialIssuance()` only when intentionally exposing the project issuer flow; display the returned witness securely for user-controlled export/import, never as an official attestation.
5. Action forms: use the typed methods from `useLendingMarketV2`; show transaction state, category, error, and explorer link from the returned lifecycle.
6. Liquidation/borrower inspection: call `inspectPosition(wallet)` and display missing oracle risk metrics as unavailable rather than estimating them in presentation code.

Presentation code should format these values and render states. It must not reconstruct proof contexts, bypass `isLendingV2ProofForContext`, infer success from a submitted hash, hardcode contract addresses, or replace service reads with placeholder market values.

## Validation and limitations

The local adapter tests, Foundry V2 tests, ZK conformance checks, and isolated Anvil journey exercise the interfaces against local-only contracts and generated proofs. These results do not establish GIWA Sepolia deployment or user wallet execution. Before enabling testnet UI use, deploy/configure the V2 pool and dependencies, assign project issuer roles, configure reserves/oracle prices, fund demo token liquidity, and set the deployed pool address. Official Dojang private balance witness availability and official Dojang-backed V2 authorization remain unresolved blockers.
