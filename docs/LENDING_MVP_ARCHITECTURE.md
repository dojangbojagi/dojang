# GIWA Lending MVP Architecture

Updated: 2026-10-10

## Scope and status

The MVP adds one proof-gated lending market to the existing protocol. It uses actual ERC20 transfers and on-chain accounting. The lender, verifier, registry, and controlled assets are **not deployed** to GIWA Sepolia. All transaction lifecycle evidence in this implementation is local Foundry/Anvil evidence.

The official Dojang integration remains a read-only Verified Address/EAS check. It does not attest to a private balance or financial eligibility. Lending eligibility is therefore explicitly sourced from an authorized issuer in the existing `DemoCredentialRegistry`; this synthetic credential is not an official Dojang credential, exchange balance, or statement about real funds. The private eligibility witness is demonstrated with controlled test values.

## Contracts

| Contract | Responsibility | Status |
| --- | --- | --- |
| `DemoCredentialRegistry` | Stores issuer-created commitment, wallet, policy, version, expiry, and revocation metadata | Existing; unchanged |
| `EligibilityVerifierAdapter` and generated `HonkVerifier` | Verifies the existing UltraHonk circuit proof | Existing; unchanged |
| `ControlledTestToken` | Capped, role-minted ERC20 used only as a lending or collateral demo asset | Added; local tests only |
| `LendingPool` | Tracks supplier principal, collateral, debt, eligibility, and ERC20 transfers | Added; local tests only |

`RestrictedVault` and policy ID `1` are unchanged. Lending uses a separate registry policy ID `2`, policy version `1`, and threshold `1,000`. Its proof must target the configured `LendingPool` address. The proof circuit's public input order remains `[wallet, commitment, policyId, policyVersion, threshold, credentialVersion, expiresAt, chainId, targetAddress]`. No circuit or verifier changes were required.

The target-address and policy checks prevent a proof made for the vault or another pool from authorizing a loan. The proof authorizes the wallet's eligibility only; it does not authorize a particular loan amount. Each borrow is independently bounded by on-chain collateral, outstanding debt, the LTV rule, and currently available liquidity. A proof can be reused for multiple partial borrows while the credential remains active, but aggregate debt cannot exceed those live limits.

At borrow time, the pool reads policy `2` from the registry and checks subject, commitment, revocation, issue time, expiry, current `ISSUER_ROLE`, policy/version, threshold, credential version, GIWA Sepolia chain ID, pool address, and the generated verifier result. Revocation or removal of the issuer role blocks later borrowing with the old proof.

## One-market risk model

| Setting | MVP value |
| --- | --- |
| Lending asset | `ControlledTestToken`, 6 decimals, symbol `gUSD` in local fixtures |
| Collateral asset | `ControlledTestToken`, 18 decimals, symbol `gCOL` in local fixtures |
| Price | Fixed 1 `gCOL` = 1 `gUSD`, normalized through token decimals |
| Maximum LTV | 50% |
| Interest | 0%; debt is principal only |
| Supplier position | 1:1 principal accounting; no yield or transferable share token |
| Liquidity | Supplier principal minus outstanding debt, capped by actual pool token balance |
| Fee/rebase token behavior | Rejected by exact balance-delta checks |

Borrow capacity is computed from the fixed one-to-one price, decimal-normalized collateral value, and 5,000 basis-point LTV. The contract accepts only tokens that expose the controlled demo marker and a non-zero mint cap; operators must still review the actual token bytecode and role configuration before deployment. The marker alone is not a token provenance proof.

This market has no price oracle, interest accrual, liquidation, bad-debt resolution, supplier yield, or production collateral valuation. A fixed price is only meaningful for these controlled demonstration assets. The market must not be configured with real or volatile assets, described as production lending, or used to imply a safe real-world collateral value.

## Credential and proof lifecycle

1. An account with the registry's `ISSUER_ROLE` creates policy `2` for the intended wallet. The commitment binds the private value, random salt, wallet, policy, version, threshold, credential version, expiry, chain ID, and configured pool address.
2. The borrower receives the private witness through a deliberate secure delivery path. Do not log or send the private value or salt to analytics or URLs.
3. The browser checks the policy `2` registry record and current issuer role, executes the existing Noir circuit, generates an EVM-targeted UltraHonk proof, and verifies it locally.
4. The borrower approves and deposits the actual collateral token. A private balance proof never counts as deposited collateral.
5. `LendingPool.borrow` checks current collateral, liquidity, the live LTV, active issuer credential, proof context, and the generated verifier. It transfers loan tokens and records debt only if all checks pass.
6. Repayment transfers loan tokens back and reduces principal debt. Collateral can be withdrawn only if the remaining collateral still covers all debt. Supplier withdrawals are limited to unborrowed liquidity.

No new private data is introduced into the circuit. The generated proof and the nine public inputs are submitted; the underlying eligibility value and salt are not.

## Configuration

The application reads `NEXT_PUBLIC_LENDING_POOL_CONTRACT` through the centralized environment schema. A missing address means the market is unavailable; it is not replaced by a sample or locally tested address. The lending asset and collateral asset addresses are read from the configured pool. `NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT` must point to the same registry used to deploy that pool.

Before any GIWA Sepolia deployment, operators still need to deploy and verify the controlled assets, registry, generated verifier and adapter, and LendingPool; grant the intended issuer role; independently verify all constructor links and roles; configure the verified addresses; then review the market and risk model. This task does not perform any of those external actions.

## Local verification commands

```sh
bun run contracts:build
bun run contracts:test
bun run lending:proof-fixture
bun run lending:anvil
```

`lending:proof-fixture` creates a real proof for the deterministic Foundry test pool and locally verifies it against Barretenberg. The integration test checks the fixture's pool address, so the fixture must be regenerated if the LendingPool creation bytecode or deterministic test deployment changes. Generated verifier artifacts contain linked libraries; the fixture script documents and pins the Foundry test deployment addresses rather than treating unresolved library placeholders as deployable bytecode.

`lending:anvil` starts a local chain with chain ID `91342`, deploys the generated verifier and lending contracts, generates a proof bound to that ephemeral pool, executes the complete lending lifecycle, checks failure paths, receipts, events, balances, debt, and collateral readback, then stops Anvil. Its local transaction hashes are not GIWA Sepolia transactions.

The latest recorded local run completed on 2026-10-10. Its ephemeral pool was `0xa513e6e4b8f2a923d98304ec87f64353c4d5c853`; the real generated proof was accepted, corrupted proof and above-LTV borrowing were rejected, and final debt/collateral/supplier positions were zero while the supplier recovered the full token principal. The borrow receipt was `0x2d19ff4709264bb9b0a965be40840d33c627cc3542d61e9aadcc78c13d470ca5` at local block `17`. These addresses and receipts belong only to that local Anvil run.
