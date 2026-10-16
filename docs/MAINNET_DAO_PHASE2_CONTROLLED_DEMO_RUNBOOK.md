# Robinhood Mainnet DAO Phase 2 Controlled Demo Runbook

This runbook is for the already deployed Robinhood Mainnet stack (chain 4663). It describes future operations only. No command below has been signed or broadcast by this preparation. Do not use this setup for public production Lending: assets and prices are synthetic, oracle updates are controlled, and DAO Phase 2 voting is commit–reveal rather than anonymous.

## Safety gate and limits

The Mainnet Lending pool is deployed paused. Its on-chain constructor pins the two synthetic assets and credential registry, marks the components demo-only, and initially grants the risk-taking participant role only to the two configured demo addresses. The operator status/unpause gate now reconstructs current participant-role holders from the pool's complete bounded `RoleGranted`/`RoleRevoked` event history and refuses a widened allowlist. `supply`, `borrow`, and collateral enabling are participant and Policy 3 proof gated; collateral deposits are participant gated; repayment and withdrawals remain exit paths. A privileged administrator can still grant new roles after the check, and a privileged risk administrator can change reserve configuration, so this remains an operator-controlled demonstration, not a trustless public market. Keep those keys separate and controlled.

The default asset limits are contract-level limits, not a target allocation. Approve both exact oracle WAD prices and all four participant token allocations before proceeding. Set local ignored `.env` values `RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_LOAN` and `RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_COLLATERAL` to owner-approved per-mint ceilings; blank values deliberately block mint simulations. Never infer market prices from these synthetic bounds.

The confirmed local Mainnet broadcast artifact records these constructor limits (they still need a fresh live RPC read before use): dUSD has 6 decimals and a 1,000 dUSD immutable mint cap; dCOL has 18 decimals and a 1,000 dCOL cap. Lending reserves cap supply at 100 dUSD, borrowing at 25 dUSD, and total collateral at 100 dCOL. The synthetic price bounds are 0.95–1.05 WAD for dUSD and 1.9–2.1 WAD for dCOL; reserve max oracle age is 600 seconds. These values constrain synthetic test balances, not real-value exposure or a market price.

One conservative **unapproved candidate** for a small two-wallet run is dUSD=1.00 WAD and dCOL=2.00 WAD (the centers of their deployed synthetic bounds); Wallet A receives 2.1 dUSD and 4 dCOL, Wallet B receives 0.1 dUSD and 4 dCOL, and each borrows 1 dUSD sequentially. A supplies 2 dUSD first; the 0.1 dUSD held by each wallet is an interest/repayment margin. At the lower collateral bound, 4 dCOL still supports more than 1 dUSD under the deployed 25% LTV. The scenario uses 2.2 dUSD and 8 dCOL total, all synthetic. Owner/PM must approve it or supply alternatives; nothing here is authorization.

## 1. Read-only preflight

```sh
bun run robinhood:mainnet:lending:operator status
bun run robinhood:mainnet:dao2:status
```

Both commands must complete live RPC checks against chain 4663. Confirm the Mainnet Lending pool and both Phase 2 contracts remain paused; all ten base deployment receipts, runtime bytecode, dependencies, demo markers and operational roles; the two participant allowlist entries; reserve flags and caps; token total supplies and pool balances; and current oracle prices/freshness. An RPC failure is a blocked check, never a PASS. Do not proceed on recorded artifacts alone.

## 2. Prepare bounded Lending bootstrap (no writes by default)

Use the precise WAD values approved by the owner and PM, and the approved base-unit allocation for each recipient. These values are intentionally placeholders:

```sh
bun run robinhood:mainnet:lending:operator price loan <APPROVED_LOAN_PRICE_WAD>
bun run robinhood:mainnet:lending:operator price collateral <APPROVED_COLLATERAL_PRICE_WAD>
bun run robinhood:mainnet:lending:operator mint loan <PARTICIPANT_A> <APPROVED_LOAN_UNITS_A>
bun run robinhood:mainnet:lending:operator mint collateral <PARTICIPANT_A> <APPROVED_COLLATERAL_UNITS_A>
bun run robinhood:mainnet:lending:operator mint loan <PARTICIPANT_B> <APPROVED_LOAN_UNITS_B>
bun run robinhood:mainnet:lending:operator mint collateral <PARTICIPANT_B> <APPROVED_COLLATERAL_UNITS_B>
```

These calls simulate only. Price values must be within deployed on-chain bounds. Mint preparation checks the fixed total supply cap, per-mint approved cap, zero current recipient balance, and complete bounded `Transfer(0x0, recipient)` history from the real token creation block. It fails closed if log history cannot be proved complete. Price writes require the configured oracle updater; token minting requires the configured minter.

Issue one distinct, chain-4663 and pool-bound Policy 3 witness per participant. The local terminal hides the entered test value; the generated JSON is created exclusively with mode `0600` and must be transferred privately to its matching wallet/device:

```sh
bun run robinhood:mainnet:lending:operator prepare-lending <PARTICIPANT_A> 7 "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy3.json"
bun run robinhood:mainnet:lending:operator issue-lending "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy3.json"
bun run robinhood:mainnet:lending:operator prepare-lending <PARTICIPANT_B> 7 "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy3.json"
bun run robinhood:mainnet:lending:operator issue-lending "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy3.json"
```

`issue-lending` simulates only and verifies the witness commitment against the correct wallet, Policy 3, chain 4663, lending pool and next credential version. The actual write requires the project credential issuer.

## 3. Explicitly authorized Mainnet writes

Run a simulation immediately before each separate write. Only after the owner approves that exact operation, price/allocation, recipient and role may the role owner add the execution flags shown here. The CLI checks the encrypted Foundry alias resolves to the configured role address, requires a local interactive terminal and typed confirmation, waits for a successful receipt, then checks post-state. `cast wallet address`/`cast send` may prompt locally for a keystore password; never put it in a command, environment variable or log.

```sh
# Oracle updater signs; repeat separately for loan and collateral.
bun run robinhood:mainnet:lending:operator price loan <APPROVED_LOAN_PRICE_WAD> --execute --authorize-mainnet-lending-write=oracle-price --account-alias <ORACLE_UPDATER_ALIAS>
bun run robinhood:mainnet:lending:operator price collateral <APPROVED_COLLATERAL_PRICE_WAD> --execute --authorize-mainnet-lending-write=oracle-price --account-alias <ORACLE_UPDATER_ALIAS>

# Configured demo minter signs; one call per token and participant.
bun run robinhood:mainnet:lending:operator mint loan <PARTICIPANT_A> <APPROVED_LOAN_UNITS_A> --execute --authorize-mainnet-lending-write=token-mint --account-alias <DEMO_MINTER_ALIAS>
bun run robinhood:mainnet:lending:operator mint collateral <PARTICIPANT_A> <APPROVED_COLLATERAL_UNITS_A> --execute --authorize-mainnet-lending-write=token-mint --account-alias <DEMO_MINTER_ALIAS>
bun run robinhood:mainnet:lending:operator mint loan <PARTICIPANT_B> <APPROVED_LOAN_UNITS_B> --execute --authorize-mainnet-lending-write=token-mint --account-alias <DEMO_MINTER_ALIAS>
bun run robinhood:mainnet:lending:operator mint collateral <PARTICIPANT_B> <APPROVED_COLLATERAL_UNITS_B> --execute --authorize-mainnet-lending-write=token-mint --account-alias <DEMO_MINTER_ALIAS>

# Credential issuer signs; repeat for each private witness file.
bun run robinhood:mainnet:lending:operator issue-lending "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy3.json" --execute --authorize-mainnet-lending-write=credential-policy-3 --account-alias <CREDENTIAL_ISSUER_ALIAS>
bun run robinhood:mainnet:lending:operator issue-lending "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy3.json" --execute --authorize-mainnet-lending-write=credential-policy-3 --account-alias <CREDENTIAL_ISSUER_ALIAS>

# The unpause simulation refuses unless both credentials and both bounded fresh prices
# are active and both recipients have both approved synthetic assets. Pause authority signs.
bun run robinhood:mainnet:lending:operator unpause-pool --execute --authorize-mainnet-lending-write=unpause-lending --account-alias <PAUSE_AUTHORITY_ALIAS>
```

Immediately re-run `status` after every write. Never group the operations into one unattended signing process.

## 4. Genuine Lending actions and reputation evidence

Open `/lending`, explicitly choose **Robinhood Mainnet · Controlled**, then connect Wallet A and confirm chain 4663. Import only Wallet A's matching private Policy 3 witness, generate the real Noir/Barretenberg proof, and complete the UI's local proof verification. Wallet A approves the loan token, supplies enough liquidity, deposits collateral, enables it with a fresh proof, then borrows and repays the actual accrued debt. Wallet B separately imports its witness, deposits collateral, enables collateral, borrows, and fully repays. Each wallet needs enough of the synthetic loan token to cover accrued interest beyond principal and enough synthetic collateral for the deployed LTV. Each also pays its own Mainnet gas.

For either wallet to reach the deployed reputation threshold of 3, canonical history must include at least one participation event, one `Borrowed` event and a `Repaid` event whose remaining debt is zero; the current score model yields 4 for that sequence and subtracts 2 for any liquidation. Supply only by Wallet A is not enough to qualify A. To avoid borrowing against unapproved assumptions, select amounts using the live reserve limits, fresh bounded prices, actual pool liquidity, and `getAccountData` health factor readbacks. Repeat the bounded `price` simulation/write near the borrow steps if the on-chain reserve's `maxOracleAge` requires it.

Read-only canonical evidence and privately prepared Policy 5 witnesses:

```sh
bun run robinhood:mainnet:dao2:operator status <PARTICIPANT_A>
bun run robinhood:mainnet:dao2:operator evidence <PARTICIPANT_A> "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.evidence.json"
bun run robinhood:mainnet:dao2:operator prepare-membership <PARTICIPANT_A> 7 "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json"
bun run robinhood:mainnet:dao2:operator status <PARTICIPANT_B>
bun run robinhood:mainnet:dao2:operator evidence <PARTICIPANT_B> "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.evidence.json"
bun run robinhood:mainnet:dao2:operator prepare-membership <PARTICIPANT_B> 7 "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json"
```

DAO evidence is reconstructed from finalized Robinhood Mainnet Lending events and ArbSys L2 height, never from Testnet/local history. The generated evidence and witness files are private. First, the Mainnet admin simulates and separately authorizes Reputation activation after both canonical evidence files and witnesses are ready. Reputation claims cannot be recorded while that registry is paused. Then the reputation issuer simulates and separately authorizes each `issue-reputation <witness> <witness>.evidence.json`; the credential issuer simulates and separately authorizes each `issue-credential <witness>`. Both live score readbacks must meet the contract threshold and each claim must be active before Policy 5 issuance. Governance remains paused through these steps.

Before recording membership claims, verify that the local Barretenberg CRS directory is complete and test a genuine Policy 5 proof against the deployed Mainnet adapter with a read-only call:

```sh
test -s "${BB_CRS_PATH:-$HOME/.bb-crs}/g1_compressed.dat" || { echo "Missing Barretenberg g1_compressed.dat CRS"; exit 1; }
DAO_PHASE2_CHAIN_ID=4663 \
DAO_PHASE2_GOVERNANCE_ADDRESS=0x0d543953a62a932ca687b160a59b8950af52c252 \
DAO_PHASE2_VERIFY_ADAPTER_ADDRESS=0x311d58862576C1C8Ae97c7AEE6A2DA17FB20e3BD \
bun run robinhood:dao2:proof
```

This check generates a local proof and calls the deployed adapter only if Mainnet RPC is reachable. It does not submit a transaction. A proof or CRS failure blocks membership activation; do not replace it with a fixture or a Testnet proof.

```sh
# Mainnet admin signs only after read-only evidence/score checks are complete.
bun run robinhood:mainnet:dao2:operator unpause reputation --execute --authorize-mainnet-dao2-write=mainnet-dao2-unpause-reputation --account-alias <MAINNET_ADMIN_ALIAS>

# Risk administrator is the configured reputation issuer; simulate and execute separately per wallet.
bun run robinhood:mainnet:dao2:operator issue-reputation "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json" "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json.evidence.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-reputation --account-alias <REPUTATION_ISSUER_ALIAS>
bun run robinhood:mainnet:dao2:operator issue-reputation "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json" "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json.evidence.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-reputation --account-alias <REPUTATION_ISSUER_ALIAS>

# Membership issuer signs each Policy 5 credential after its active matching claim is confirmed.
bun run robinhood:mainnet:dao2:operator issue-credential "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-credential --account-alias <MEMBERSHIP_ISSUER_ALIAS>
bun run robinhood:mainnet:dao2:operator issue-credential "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-credential --account-alias <MEMBERSHIP_ISSUER_ALIAS>

# Activate Governance only after both Policy 5 records are read back as active.
bun run robinhood:mainnet:dao2:operator unpause governance --execute --authorize-mainnet-dao2-write=mainnet-dao2-unpause-governance --account-alias <MAINNET_ADMIN_ALIAS>
```

Run the matching simulation command first by omitting `--execute`, `--authorize-mainnet-dao2-write`, and `--account-alias`; verify the configured address and required role before each individually authorized write. Re-run `status <wallet>` after every transaction. These commands do not grant roles.

## 5. Activate Phase 2 and conduct the two-voter lifecycle

After the ordered activation above, each wallet opens `/dao`, chooses Mainnet, connects that same wallet on chain 4663, imports its Policy 5 witness, generates and locally verifies the genuine proof, and registers proof-backed membership. Wallet A creates the proposal. Both independent members commit before the live commit deadline; each keeps its own mode-0600 ballot file. A commit/reveal ballot hides the choice only until reveal; wallet identity and choice become linkable on reveal.

For encrypted-keystore commit/reveal, the CLI simulates first and verifies the alias address against the selected wallet. Use the explicit voter address for every step:

```sh
bun run robinhood:mainnet:dao2:operator commit-vote <PROPOSAL_ID> for "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-ballot.json" --voter-address <PARTICIPANT_A>
bun run robinhood:mainnet:dao2:operator commit-vote <PROPOSAL_ID> for "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-ballot.json" --voter-address <PARTICIPANT_A> --execute --authorize-mainnet-dao2-write=mainnet-dao2-commit-vote --account-alias <WALLET_A_ALIAS>
bun run robinhood:mainnet:dao2:operator commit-vote <PROPOSAL_ID> for "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-ballot.json" --voter-address <PARTICIPANT_B> --execute --authorize-mainnet-dao2-write=mainnet-dao2-commit-vote --account-alias <WALLET_B_ALIAS>
```

The second command form shown is execution-only; simulate each wallet's command first. Wait for the actual on-chain 3,600-second commit period, then each wallet separately simulates and reveals using its saved ballot file. Do not lose the files: reveal requires the original salt. Wait for the actual 3,600-second reveal period, then call the UI's finalize action only when `proposalState` permits it. Execute only after quorum 2, approval, and the contract's execution window are confirmed. Proposal creation, membership registration, finalization and execution remain wallet transactions and require separate operator/owner decisions. Never claim Proposal #1 from Testnet is a Mainnet transaction.

## 6. Mainnet frontend publication

Only after confirming each public value against current chain 4663 readbacks, set these **public** Vercel Production variables and redeploy the web app:

```text
NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_REPUTATION_REGISTRY_CONTRACT=0x0329f0c47a7e2d390b0593fe3f3348b4c467158c
NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_GOVERNANCE_CONTRACT=0x0d543953a62a932ca687b160a59b8950af52c252
```

The base Mainnet Lending registry is receipt-derived in the typed repository registry; do not paste Testnet addresses into Mainnet variables. Do not configure signer or issuer keys in Vercel. After deployment, check `/lending`, `/dao`, and `/contracts`: chain 4663 selected only by the user, live addresses and dependencies match, Mainnet Lending and Phase 2 pause states match live RPC, credentials/scores are wallet-specific, and transaction buttons remain blocked while paused or otherwise ineligible. Confirm existing Testnet routes still resolve chain 46630 and its own registry.

## Remaining approval gates

- Owner/PM: exact two synthetic prices and four recipient allocations, token mint ceilings, gas funding, and whether to accept the disclosed privileged administrator/risk issuer trust model for this restricted recording.
- Oracle updater: separately approved price writes.
- Demo minter: separately approved four mint writes.
- Credential issuer: separately approved Policy 3 issuance per wallet.
- Pause authority: separately approved Lending unpause only after the fresh live gate passes.
- Each participant wallet: its own approvals, lending actions, membership registration, commit and reveal (browser wallet or matching encrypted Foundry alias).
- Reputation issuer and admin: separately approved claims and Phase 2 activations.

Current live RPC access must be restored and all read-only statuses re-run before this workflow can be simulated against the deployed contracts. This file is not deployment authorization or a claim that the browser wallet flow has passed.
