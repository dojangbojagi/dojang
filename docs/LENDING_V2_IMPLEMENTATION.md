# LendingPoolV2 implementation

## Status and boundary

`LendingPoolV2` is a separately versioned, locally tested lending engine. `LendingPool` and its current frontend hooks remain unchanged. There is no V2 deployment address and this work did not broadcast any transaction.

The V2 proof gate uses the existing nine-public-input eligibility circuit, generated Honk verifier, verifier adapter, and `DemoCredentialRegistry`, with a new policy ID (`3`) and a proof domain bound to the V2 pool address. That is a **project-issued test credential** path. Official Dojang credential issuance and the private Verified Balance/Merkle witness path remain blocked as documented in `DOJANG_LENDING_FEASIBILITY.md`; V2 does not claim Dojang-backed lending.

## Financial model

- Each configured reserve is a supported, project-controlled test ERC-20 with the existing controlled-demo asset marker and a nonzero mint cap. Token decimals are read at configuration and values above 18 are rejected.
- Suppliers own reserve shares. Borrowers own debt shares. The liquidity and borrow indices convert shares to current amounts. Collateral is separately accounted from lendable reserve liquidity.
- Available liquidity is the pool token balance less collateral held for users. A borrow must fit both this liquidity and the configured reserve borrow cap.
- Prices are quoted in WAD per whole token. The pool normalizes raw token amounts using the reserve's on-chain decimals: `valueWad = amount * priceWad / 10^decimals`.
- User collateral is valued at each collateral reserve's `maxLtvBps` for borrowing capacity and `liquidationThresholdBps` for health factor. Debt is valued with the corresponding debt reserve price. Borrowing must satisfy both LTV and liquidation health checks.
- Liquidation is permissionless when health factor is below `1e27`. The debt reserve's close-factor limit bounds repayment. The collateral reserve's bonus determines seizure. The borrower needs no current credential for liquidation.
- Repayment, supply withdrawal subject to available liquidity, and collateral recovery after full repayment do not require a live credential. Repayment does not read the oracle. Full collateral withdrawal skips health-price reads after all debt is gone. Risk-increasing supply, collateral activation, and borrowing require active policy-3 credentials and verifier-accepted proofs.
- ERC-20 transfers check exact sender/pool/recipient balance deltas; fee-on-transfer or rebasing behavior is rejected. Mutating token operations are protected by `ReentrancyGuard`.

## Interest model

Rates are annual basis points and accrue as a **simple linear index increase per elapsed interval**, not continuously compounded interest. Utilization is `debt / (available liquidity + debt)`. For utilization `u`, optimal utilization `k`, base rate `b`, and slopes `s1` and `s2`:

```text
if u <= k: borrow APR = b + s1 * u / k
otherwise: borrow APR = b + s1 + s2 * (u - k) / (1 - k)
supplier APR = borrow APR * utilization * (1 - reserve factor)
```

Debt-index rounding is upward when shares are created; user debt reads and supplier index growth use full-precision integer math with conservative rounding. Interest is applied when a reserve is accrued or projected for a read. The reserve factor is retained as withdrawable protocol fees; supplier interest is distributed through the liquidity index. These values are estimates and can change when utilization or risk settings change.

## Initial test profile

The deployment script uses 6-decimal `gUSD2` and 18-decimal `gCOL2`. Its per-token mint caps are 1,000,000 tokens; the reserve limits are:

| Parameter | gUSD2 debt/liquidity reserve | gCOL2 collateral reserve |
| --- | ---: | ---: |
| Supply cap | 100,000 gUSD2 | Disabled |
| Borrow cap | 50,000 gUSD2 | Disabled |
| Collateral cap | Disabled | 100,000 gCOL2 |
| Minimum borrow | 1 gUSD2 | Not applicable |
| Maximum LTV | 50% | 50% |
| Liquidation threshold | 65% | 65% |
| Liquidation bonus | 5% | 5% |
| Maximum close factor | 50% | 50% |
| Base borrow APR | 2% | 2% |
| Slope 1 / slope 2 | 4% / 60% | 4% / 60% |
| Optimal utilization | 80% | 80% |
| Reserve factor | 10% | 10% |
| Maximum oracle age | 3,600 seconds | 3,600 seconds |

These are proposed test-only settings drawn from the owner brief and token precision. They are **not owner-approved deployment parameters** or a production risk recommendation. The deployment script configures gUSD2's test bounds to 0.95–1.05 quote units and gCOL2's to 0.5–4 quote units, but intentionally seeds no prices. A price must be set separately by the authorized updater before price-dependent operations can succeed.

## Oracle trust assumptions

`ControlledTestOracle` is an admin-controlled fixture, not a market oracle. It stores positive prices in WAD, checks configured minimum/maximum bounds, and timestamps each update. The pool fails closed for unavailable, zero, future, or stale observations. The local Anvil lifecycle deliberately seeds synthetic fixture prices and performs a synthetic price change solely to exercise liquidation. Those values are not price evidence and do not establish real token value.

The deployment script initially grants the admin the oracle's default-admin and price-updater roles; the pool admin also initially holds admin, risk-admin, and pauser roles. Production role separation and operational price procedures require owner approval and a separate production oracle design.

## Deployment dependency order

The V2 script requires an existing GIWA Sepolia deployment of:

1. `DemoCredentialRegistry` on chain 91342, with the configured, separate `GIWA_ISSUER_ADDRESS` holding `ISSUER_ROLE`.
2. The generated `HonkVerifier` and `EligibilityVerifierAdapter` using the existing circuit/verifier artifact. The adapter address must have code and retain the expected nine-input verifier behavior.
3. A configured `GIWA_ADMIN_ADDRESS` for the deployment sender and initial pool/oracle roles.

`DeployLendingV2GIWASepolia.s.sol` then creates the two controlled test assets, controlled oracle, and pool, configures bounds and reserves, and emits their addresses. It does not grant issuer authority, issue credentials, or seed oracle prices. It refuses the run if registry/verifier bytecode or the issuer role is missing. Local deployment requires no external addresses because the Anvil fixture deploys those dependencies locally.

Run a dry simulation only after filling public addresses in a local deployment environment:

```sh
bun run deployment:simulate -- script/DeployLendingV2GIWASepolia.s.sol:DeployLendingV2GIWASepolia --rpc-url "$GIWA_RPC_URL"
```

The simulation wrapper rejects broadcast and signer options. Do not copy simulated addresses into environment configuration; only use addresses from real receipts and subsequent on-chain readback after a separately authorized deployment.

## Validation evidence

The V2 Foundry suite uses a mock verifier for focused financial/accounting tests. The local Anvil script separately deploys the generated verifier and adapter, issues policy-3 project test credentials, generates a real proof with the existing Noir circuit, verifies it locally, and exercises on-chain proof acceptance against the deployed local V2 pool. It runs only against a private ephemeral Anvil instance and reports transaction hashes, receipt status, and event evidence. This does not constitute GIWA Sepolia deployment or official Dojang verification.

Original V2 implementation checkpoint:

- `bun run contracts:test`: 78 passed, 0 failed (the prior 60-test suite plus 18 V2 tests).
- `bun run contracts:build --sizes`: passed; `LendingPoolV2` runtime is 20,288 bytes and the V2 deployment script is 4,506 bytes.
- `bun run typecheck`: passed.
- `bun run build`: passed; all existing routes prerendered.
- `bun run zk:conformance`: passed; valid proof accepted and under-threshold, mismatched-commitment, and wrong-wallet witnesses rejected.
- `bun run lending:v2:anvil`: passed with a local Foundry no-broadcast deployment simulation, real proof generation, verifier acceptance, interest accrual, repayments, withdrawals, and liquidation.

In that run, 500.000001 gUSD debt accrued to 500.924660 gUSD over 30 days at 225 BPS current borrow APR; supplier balance rose to 10,000.832193 gUSD. After a synthetic price move, the second position's health factor was below 1 and liquidation reduced its debt while transferring collateral.

Selected successful receipts from the final ephemeral Anvil run: supply `0xd5640cda278abc8f3754025aad0e52a3444ee3f06305b1397d37ef3cf6db1392`; borrow `0x73625da127dce84680c33bee55253b7293779b6891c7abbf98d3eff0038d1b66`; liquidation `0x3ba26d2e9bbdb934622f73cb103041e3e364e46a33099dd6eb565bc8293bf3f5`. These hashes belong only to the one local Anvil run and cannot be looked up on GIWA Sepolia.

## Subsequent Robinhood protocol regression checkpoint

On 2026-10-12, the full Foundry suite passed with `90` tests, including the separately versioned Robinhood DAO Phase 1 tests. Typecheck, production build, and ZK proof conformance passed. `bun run robinhood:protocol:anvil` exercised the policy-4 DAO lifecycle and the policy-3 genuine-proof Lending V2 lifecycle on ephemeral chain ID `46630`, including invalid proof/domain rejection and liquidation. Full-stack and verifier-only Foundry deployment simulations also succeeded locally without broadcast. These results do not change the earlier V2-specific run's count of 78 tests or establish a public Robinhood deployment.

## Explicitly out of scope

- No modification to V1 Lending, DAO Phase 1, Vault, the existing circuit, or the existing verifier behavior.
- No automatic state migration from V1.
- No official Dojang Verified Balance or private Merkle-witness bridge.
- No production/oracle security claim, audit claim, real-asset support, or deployment claim.
- No frontend presentation changes. The V2 ABI/configuration are exposed for a separate UI integration handoff.
