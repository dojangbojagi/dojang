# Robinhood Mainnet Controlled Demo Approval Package

Status: preparation only. No Mainnet deployment or writes are authorized by this document. The Lending pool is constructed paused, the oracle has no initial prices, and tokens are not minted during deployment.

## Values requiring owner approval

These are conservative demo proposals, not production recommendations. Approve or replace them before putting values in `.env`.

| Parameter | Proposed value | Meaning and constraint |
| --- | ---: | --- |
| `RH_MAINNET_DEMO_GOVERNANCE_VOTING_PERIOD` | `86400` | 86,400 seconds (24 hours); contract maximum 30 days. |
| `RH_MAINNET_DEMO_GOVERNANCE_QUORUM` | `2` | Two credentialed voters; quorum is an absolute vote count, not a percentage. |
| `RH_MAINNET_DEMO_GOVERNANCE_EXECUTION_WINDOW` | `172800` | 172,800 seconds (48 hours); contract maximum 90 days after voting. |
| `RH_MAINNET_DEMO_GOVERNANCE_INITIAL_MIN_VALIDITY` | `3600` | 3,600 seconds (1 hour) remaining credential validity required at action time; contract maximum 365 days. |
| `RH_MAINNET_DEMO_LOAN_MINT_CAP` | `1000000000` | 1,000 dUSD at 6 decimals, total lifetime mint ceiling. |
| `RH_MAINNET_DEMO_COLLATERAL_MINT_CAP` | `1000000000000000000000` | 1,000 dCOL at 18 decimals, total lifetime mint ceiling. |
| `RH_MAINNET_DEMO_LENDING_SUPPLY_CAP` | `100000000` | 100 dUSD at 6 decimals; below the dUSD mint ceiling. |
| `RH_MAINNET_DEMO_LENDING_BORROW_CAP` | `25000000` | 25 dUSD at 6 decimals; must not exceed the supply cap. |
| `RH_MAINNET_DEMO_COLLATERAL_CAP` | `100000000000000000000` | 100 dCOL at 18 decimals; below the dCOL mint ceiling. |
| `RH_MAINNET_DEMO_MIN_BORROW_AMOUNT` | `1000000` | 1 dUSD at 6 decimals; must be nonzero and at most the borrow cap. |
| `RH_MAINNET_DEMO_MAX_ORACLE_AGE` | `600` | 600 seconds (10 minutes); demo risk configuration, not a price source. |
| `RH_MAINNET_DEMO_MAX_LTV_BPS` | `2500` | 25%; 10,000 bps = 100%. Must not exceed liquidation threshold. |
| `RH_MAINNET_DEMO_LIQUIDATION_THRESHOLD_BPS` | `4000` | 40%; must be below 10,000 bps and at least max LTV. |
| `RH_MAINNET_DEMO_LIQUIDATION_BONUS_BPS` | `500` | 5% liquidator bonus; contract maximum 5,000 bps. |
| `RH_MAINNET_DEMO_CLOSE_FACTOR_BPS` | `2500` | At most 25% of debt per liquidation; must be 1–10,000 bps. |
| `RH_MAINNET_DEMO_RESERVE_FACTOR_BPS` | `2000` | 20% of interest allocated to reserves; must be 0–10,000 bps. |
| `RH_MAINNET_DEMO_OPTIMAL_UTILIZATION_BPS` | `5000` | 50% utilization kink; must be between 0 and 10,000 bps. |
| `RH_MAINNET_DEMO_BASE_BORROW_RATE_BPS` | `100` | 1% annual base rate. |
| `RH_MAINNET_DEMO_SLOPE1_BPS` | `300` | 3% annual rate increase up to optimal utilization. |
| `RH_MAINNET_DEMO_SLOPE2_BPS` | `1200` | 12% annual increase above optimal; proposed endpoint sum is 16% annual. Combined rate must stay at or below the contract's 1,000% ceiling. |
| `RH_MAINNET_DEMO_LOAN_PRICE_MIN_WAD` | `950000000000000000` | Synthetic dUSD lower bound 0.95; WAD uses 1e18. Not a market price. |
| `RH_MAINNET_DEMO_LOAN_PRICE_MAX_WAD` | `1050000000000000000` | Synthetic dUSD upper bound 1.05; deployment sets bounds only. |
| `RH_MAINNET_DEMO_COLLATERAL_PRICE_MIN_WAD` | `1900000000000000000` | Synthetic dCOL lower bound 1.90 WAD; not a market price. |
| `RH_MAINNET_DEMO_COLLATERAL_PRICE_MAX_WAD` | `2100000000000000000` | Synthetic dCOL upper bound 2.10 WAD. No price is seeded at deployment. |

These values cap the controlled demonstration; they do not make the synthetic assets safe, redeemable, or suitable for public lending. Keep the pool paused and keep both demo assets isolated from real-value tokens. Price updates, minting, credential issuance, and unpausing need separate explicit authorization after deployment.

## Address and signer preparation

The nine following public addresses must be valid and pairwise distinct:

```dotenv
RH_MAINNET_DEPLOYER_ADDRESS=
RH_MAINNET_ADMIN_ADDRESS=
RH_MAINNET_ISSUER_ADDRESS=
RH_MAINNET_ORACLE_UPDATER_ADDRESS=
RH_MAINNET_RISK_ADMIN_ADDRESS=
RH_MAINNET_PAUSE_AUTHORITY_ADDRESS=
RH_MAINNET_DEMO_MINTER_ADDRESS=
RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS=
RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS=
```

`RH_MAINNET_ACCOUNT` is a local Foundry keystore alias, not a public address or secret. `RH_MAINNET_RPC_URL` should be the chain-4663 HTTPS RPC selected by the owner; use a dedicated provider if the public endpoint is unreliable. Never place keys, passwords, seed phrases, keystore contents, or API credentials in `.env` or this document.

For new locally controlled keys, create each encrypted keystore interactively. `cast wallet new` prompts for a password without echoing it and prints the public address; save each password in a password manager. Do not use `--unsafe-password`, shell variables for passwords, private-key flags, or commands that print/export secrets.

```sh
mkdir -p "$HOME/.foundry/keystores"
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-deployer
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-admin
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-issuer
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-oracle-updater
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-risk-admin
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-pause-authority
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-demo-minter
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-participant-a
cast wallet new "$HOME/.foundry/keystores" gyevo-rh-mainnet-participant-b
```

Use the printed public addresses to fill the nine address fields. Do not reuse one key for multiple roles. Where the owner chooses an existing hardware/MPC-controlled address, record only that public address; no local keystore is needed for that role. Do not fund any wallet as part of this preparation. Participants need to be controlled by the intended demo users. The deployer alias must resolve to `RH_MAINNET_DEPLOYER_ADDRESS`:

```sh
cast wallet address --account gyevo-rh-mainnet-deployer
```

Compare the displayed public address locally; never paste passwords or keystore data into chat or logs. New role keys do not need to be imported into a browser wallet to configure the deployment. Browser access and participant key custody are separate owner decisions.

## Prepared automatically vs owner input

**Fixed by the isolated code path:** chain ID 4663 and the `robinhood_mainnet` Foundry profile; demo token identities/decimals; chain- and pool-bound verifier integration; Lending and governance start paused; oracle bounds are configured without an initial price; no tokens are minted; no deployment output addresses are assumed or populated.

**Owner must choose and approve:** HTTPS RPC provider, protected deployer alias and matching public address, all nine unique role/participant addresses, and all 24 parameters above. The proposed numbers are not approved until the owner explicitly accepts them. The `.env.example` Mainnet fields intentionally remain blank; do not change the real `.env` during this preparation.

## Read-only validation and final simulation

After the owner has entered the approved public values in their local `.env`, run:

```sh
bun run robinhood:mainnet:demo:validate-config
cast wallet address --account gyevo-rh-mainnet-deployer
bun run robinhood:mainnet:demo:simulate
```

Compare the keystore-derived address to `RH_MAINNET_DEPLOYER_ADDRESS`. The simulation wrapper checks the configured RPC returns chain ID 4663, uses the explicitly selected `robinhood_mainnet` profile and `--chain-id 4663`, and refuses signer/broadcast flags. A successful simulation is still not owner authorization to deploy. Review the exact final parameters, role addresses, gas result, and simulation output together before any separate deployment approval.

The validator prints missing key names and validation findings, not configured values. It checks HTTPS RPC syntax, Foundry alias syntax, nine distinct EVM addresses, integer widths, constructor ranges, cap relationships, LTV/liquidation ordering, rate ceiling, and ordered price bounds. It does not unlock a keystore, prove that a role address is controlled, query RPC chain ID, or grant approval; the final simulation performs the live chain-ID check.

## Deployment-blocking decisions and findings

- **No deployment until owner configuration is complete:** current real `.env` has not been populated with the RPC/account, nine addresses, or 24 approved parameters.
- **Administrator trust model:** the configured admin receives `DEFAULT_ADMIN_ROLE` and can grant/revoke operational roles. Confirm that this authority is acceptable and strongly protected; separate role addresses do not constrain the admin's ability to reassign roles.
- **Pause authority:** it can pause and unpause the demo pool. Confirm who may unpause and require a separate owner decision before unpausing.
- **Asset/oracle limitations:** the two tokens and bounded oracle are synthetic demo-only components. No production oracle, real collateral, redemption, audit, or public production Lending claim is supported.
- **Independent review:** the Mainnet demo contracts are not a substitute for a third-party security review. Do not represent the controlled demo as production-ready.

No source changes in this package deploy contracts, sign transactions, fund accounts, set prices, mint tokens, issue credentials, or unpause contracts.
