# Robinhood Mainnet DAO Phase 2 Controlled Demo Runbook

This runbook is for the already deployed Robinhood Mainnet stack (chain 4663). It describes future operations only. No command below has been signed or broadcast by this preparation. Do not use this setup for public production Lending: assets and prices are synthetic, oracle updates are controlled, and DAO Phase 2 voting is commit–reveal rather than anonymous.

## Safety gate and limits

The Mainnet Lending pool is deployed paused. Its Mainnet-specific Solidity implementation pins the two synthetic assets and credential registry, marks the components demo-only, and grants `DEMO_PARTICIPANT_ROLE` to the two configured participants. `supply`, `borrow`, and collateral enabling enforce both the participant role and active Policy 3 proof requirements on-chain. `depositCollateral` also enforces the participant role, but has no pause modifier; a designated participant can deposit collateral while the pool is paused. This does not activate borrowing power: enabling collateral checks the paused state, and borrowing is pause-gated. Repayment and withdrawals remain exit paths. The operator status/unpause gate reconstructs current participant-role holders from the bounded role-event history and refuses a widened allowlist. A privileged administrator can still grant roles after that check, and a privileged risk administrator can change reserve configuration; this is an operator-controlled synthetic-asset demonstration, not a trustless or production lending market.

The default asset limits are contract-level limits, not a target allocation. Approve both exact oracle WAD prices and all four participant token allocations before proceeding. Set local ignored `.env` values `RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_LOAN` and `RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_COLLATERAL` to owner-approved per-mint ceilings; blank values deliberately block mint simulations. Never infer market prices from these synthetic bounds.

The confirmed local Mainnet broadcast artifact records these constructor limits (they still need a fresh live RPC read before use): dUSD has 6 decimals and a 1,000 dUSD immutable mint cap; dCOL has 18 decimals and a 1,000 dCOL cap. Lending reserves cap supply at 100 dUSD, borrowing at 25 dUSD, and total collateral at 100 dCOL. The synthetic price bounds are 0.95–1.05 WAD for dUSD and 1.9–2.1 WAD for dCOL; reserve max oracle age is 600 seconds. These values constrain synthetic test balances, not real-value exposure or a market price.

One conservative **unapproved candidate** for a small two-wallet run is dUSD=1.00 WAD and dCOL=2.00 WAD (the centers of their deployed synthetic bounds); Wallet A receives 2.1 dUSD and 4 dCOL, Wallet B receives 0.1 dUSD and 4 dCOL, and each borrows 1 dUSD sequentially. A supplies 2 dUSD first; the 0.1 dUSD held by each wallet is an interest/repayment margin. At the lower collateral bound, 4 dCOL still supports more than 1 dUSD under the deployed 25% LTV. The scenario uses 2.2 dUSD and 8 dCOL total, all synthetic. Owner/PM must approve it or supply alternatives; nothing here is authorization.

## 1. Read-only preflight

```sh
bun run robinhood:mainnet:lending:operator status
bun run robinhood:mainnet:dao2:status
```

Both commands must complete live RPC checks against chain 4663. Confirm the Mainnet Lending pool and both Phase 2 contracts remain paused; all ten base deployment receipts, runtime bytecode, dependencies, demo markers and operational roles; the two participant allowlist entries; reserve flags and caps; token total supplies and pool balances; and current oracle prices/freshness. An RPC failure is a blocked check, never a PASS. Do not proceed on recorded artifacts alone.

## 2. Reconcile already-completed provisioning and prepare prices

The owner reports that both allowlist entries, Policy 3 credentials and matching Policy 3 witnesses are already in place, and all four bounded synthetic token mints are confirmed (2.2 dUSD and 8 dCOL total). Re-run the live `status` command and participant `status A` / `status B` readbacks first. Do not repeat minting or credential issuance. If a live readback contradicts this record, stop and investigate; do not repair it with an automatic write.

Only the oracle prices are reported unseeded. The values below are conservative **unapproved candidates**, not authorization. Confirm exact values with the owner/PM, then simulate each price write against the live bounds and freshness limit:

```sh
bun run robinhood:mainnet:lending:operator price loan 1000000000000000000
bun run robinhood:mainnet:lending:operator price collateral 2000000000000000000
```

`1e18` and `2e18` are synthetic WAD values; they are not market prices. A live status/readback must confirm both prices are inside contract bounds and no older than 600 seconds before pool activation.

The participant witnesses, when needed locally, must remain private mode-0600 files and be bound to their configured wallet, Policy 3, chain 4663 and the deployed Lending pool. Do not regenerate a witness or reissue a credential just because RPC or CRS access is unavailable.

The operator's mint simulation is still available for a genuinely missing approved allocation, but it is not part of this already-provisioned flow. It requires owner-approved per-mint ceilings in ignored `.env`, complete bounded canonical mint history, current supply/balance/cap checks, and a separate approval for each individual write. Do not use it to duplicate the four reported mints.

Price writes require the configured oracle updater. No mint or credential issuer transaction is needed for the reported state.

## 3. Explicitly authorized Mainnet writes

Run a simulation immediately before each separate write. Only after the owner approves that exact operation, price/allocation, recipient and role may the role owner add the execution flags shown here. The CLI checks the encrypted Foundry alias resolves to the configured role address, requires a local interactive terminal and typed confirmation, waits for a successful receipt, then checks post-state. `cast wallet address`/`cast send` may prompt locally for a keystore password; never put it in a command, environment variable or log.

```sh
# Oracle updater signs; repeat separately for loan and collateral.
bun run robinhood:mainnet:lending:operator price loan <OWNER_APPROVED_LOAN_PRICE_WAD> --execute --authorize-mainnet-lending-write=oracle-price --account-alias gyevo-rh-mainnet-oracle
bun run robinhood:mainnet:lending:operator price collateral <OWNER_APPROVED_COLLATERAL_PRICE_WAD> --execute --authorize-mainnet-lending-write=oracle-price --account-alias gyevo-rh-mainnet-oracle

# The unpause simulation refuses unless both credentials and both bounded fresh prices
# are active and both recipients have both approved synthetic assets. Pause authority signs.
bun run robinhood:mainnet:lending:operator unpause-pool --execute --authorize-mainnet-lending-write=unpause-lending --account-alias gyevo-rh-mainnet-pauser
```

Immediately re-run `status` after every write. Never group the operations into one unattended signing process.

## 4. Genuine Lending actions and reputation evidence

Open `/lending`, explicitly choose **Robinhood Mainnet · Controlled**, then connect Wallet A and confirm chain 4663. Import only Wallet A's matching private Policy 3 witness, generate the real Noir/Barretenberg proof, and complete the UI's local proof verification. Wallet A approves the loan token, supplies enough liquidity, deposits collateral, enables it with a fresh proof, then borrows and repays the actual accrued debt. Wallet B separately imports its witness, deposits collateral, enables collateral, borrows, and fully repays. Each wallet needs enough of the synthetic loan token to cover accrued interest beyond principal and enough synthetic collateral for the deployed LTV. Each also pays its own Mainnet gas.

For either wallet to reach the deployed reputation threshold of 3, canonical history must include at least one participation event, one `Borrowed` event and a `Repaid` event whose remaining debt is zero; the current score model yields 4 for that sequence and subtracts 2 for any liquidation. Supply only by Wallet A is not enough to qualify A. To avoid borrowing against unapproved assumptions, select amounts using the live reserve limits, fresh bounded prices, actual pool liquidity, and `getAccountData` health factor readbacks. Repeat the bounded `price` simulation/write near the borrow steps if the on-chain reserve's `maxOracleAge` requires it.

### Participant transaction CLI

The browser already supports the same Mainnet operations. For the two encrypted Foundry participant wallets, the read-only and simulation-first CLI is `bun run robinhood:mainnet:lending:user`. It accepts only the configured Wallet A/B addresses, verifies the matching alias before each signed operation, keeps witness/proof bytes out of logs, simulates every contract call, estimates gas, and checks receipt sender/chain/target/calldata, pool event, and post-state. Each write needs its own exact authorization flag and interactive confirmation; never batch multiple writes into one approval.

```sh
bun run robinhood:mainnet:lending:user status A
bun run robinhood:mainnet:lending:user check-wallet-alias A
bun run robinhood:mainnet:lending:user proof A "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy3.json"
bun run robinhood:mainnet:lending:user approve A loan 2000000
bun run robinhood:mainnet:lending:user supply A 2000000 "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy3.json"
bun run robinhood:mainnet:lending:user approve A collateral 4000000000000000000
bun run robinhood:mainnet:lending:user deposit-collateral A 4000000000000000000
bun run robinhood:mainnet:lending:user enable-collateral A "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy3.json"
bun run robinhood:mainnet:lending:user borrow A 1000000 "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy3.json"
bun run robinhood:mainnet:lending:user approve-repay A
bun run robinhood:mainnet:lending:user repay-all A
```

Run every command above once without `--execute` first. A signed transaction adds `--execute --authorize-mainnet-lending-user-write=<operation> --account-alias <matching-alias>`; `approve` uses `approve-token`. The matching aliases are `gyevo-rh-mainnet-wallet-a` and `gyevo-rh-mainnet-wallet-b`. Wallet B repeats collateral approval/deposit, enable, borrow, repay approval, and repayment with label `B` and its own witness/alias. After both debt readbacks are zero, collateral can be withdrawn; Wallet A's supplier position can then be withdrawn if the live liquidity read allows it. All amounts above are base units, and none of these candidate transaction amounts are authorization.

Barretenberg CRS handling is provided by the pinned `@aztec/bb.js` 5.2.1 dependency. Browser WASM uses its IndexedDB cache and the package's HTTPS primary/fallback CRS hosts. The local CLI uses `CRS_PATH` (default `$HOME/.bb-crs`) and the package filenames `bn254_g1_compressed.dat`, `bn254_g2.dat`, and `grumpkin_g1_v2.flat.dat`; `g1_compressed.dat` alone is not the Node cache contract. Check or warm the cache without an RPC call using:

```sh
bun run robinhood:mainnet:lending:user crs-status
bun run robinhood:mainnet:lending:user crs-check
```

`crs-check` downloads only the public proof-system CRS into the local cache if needed. It does not read witnesses, connect to a wallet, or touch chain state. A restricted network must allow the dependency's configured CRS hosts or a compatible complete cache must already exist.

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

The local CRS check is independent of chain writes and can be done before the reputation work. After each active Reputation claim and matching Policy 5 credential have been read back, generate and verify each participant's actual proof:

```sh
bun run robinhood:mainnet:lending:user crs-check
```

```sh
# Mainnet admin signs only after read-only evidence/score checks are complete.
bun run robinhood:mainnet:dao2:operator unpause reputation --execute --authorize-mainnet-dao2-write=mainnet-dao2-unpause-reputation --account-alias gyevo-rh-mainnet-admin

# Risk administrator is the configured reputation issuer; simulate and execute separately per wallet.
bun run robinhood:mainnet:dao2:operator issue-reputation "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json" "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json.evidence.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-reputation --account-alias gyevo-rh-mainnet-risk
bun run robinhood:mainnet:dao2:operator issue-reputation "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json" "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json.evidence.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-reputation --account-alias gyevo-rh-mainnet-risk

# Membership issuer signs each Policy 5 credential after its active matching claim is confirmed.
bun run robinhood:mainnet:dao2:operator issue-credential "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-credential --account-alias gyevo-rh-mainnet-issuer
bun run robinhood:mainnet:dao2:operator issue-credential "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-credential --account-alias gyevo-rh-mainnet-issuer
```

Run the matching simulation command first by omitting `--execute`, `--authorize-mainnet-dao2-write`, and `--account-alias`; verify the configured address and required role before each individually authorized write. Re-run `status <wallet>` after every transaction. These commands do not grant roles.

Once both Policy 5 credentials and claims are active, run the real witness proofs against the Mainnet adapter. This read-only command recomputes each witness commitment, generates the Noir/Barretenberg proof locally, verifies it locally, and calls the deployed adapter without submitting a transaction. `bun run robinhood:dao2:proof` is only a fixture conformance check and must not be reported as either participant's proof. A participant proof or CRS failure blocks membership registration; do not replace it with a fixture or Testnet proof.

```sh
bun run robinhood:mainnet:dao2:operator proof "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json"
bun run robinhood:mainnet:dao2:operator proof "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json"

# After both proof checks and active Policy 5 readbacks, the admin separately authorizes Governance activation.
bun run robinhood:mainnet:dao2:operator unpause governance
bun run robinhood:mainnet:dao2:operator unpause governance --execute --authorize-mainnet-dao2-write=mainnet-dao2-unpause-governance --account-alias gyevo-rh-mainnet-admin
```

## 5. Activate Phase 2 and conduct the two-voter lifecycle

After the ordered activation above, each wallet opens `/dao`, chooses Mainnet, connects that same wallet on chain 4663, imports its Policy 5 witness, generates and locally verifies the genuine proof, and registers proof-backed membership. The DAO operator also supports simulation-first keystore paths for membership registration, proposal creation, finalization, execution, commits and reveals:

```sh
# Each command without execution flags is the simulation/read-only step.
bun run robinhood:mainnet:dao2:operator register-membership "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json"
bun run robinhood:mainnet:dao2:operator register-membership "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-policy5.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-register-membership --account-alias gyevo-rh-mainnet-wallet-a
bun run robinhood:mainnet:dao2:operator register-membership "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-policy5.json" --execute --authorize-mainnet-dao2-write=mainnet-dao2-register-membership --account-alias gyevo-rh-mainnet-wallet-b

# Proposal wording and threshold need owner approval; proposer is Wallet A.
bun run robinhood:mainnet:dao2:operator create-proposal "$APPROVED_PROPOSAL_REFERENCE" "$APPROVED_MINIMUM_REPUTATION" --proposer-address 0xdB354254bF1E0374963600811D1fF5643a56A367
bun run robinhood:mainnet:dao2:operator create-proposal "$APPROVED_PROPOSAL_REFERENCE" "$APPROVED_MINIMUM_REPUTATION" --proposer-address 0xdB354254bF1E0374963600811D1fF5643a56A367 --execute --authorize-mainnet-dao2-write=mainnet-dao2-create-proposal --account-alias gyevo-rh-mainnet-wallet-a

# Read current lifecycle state/times at any point.
bun run robinhood:mainnet:dao2:operator proposal "$PROPOSAL_ID"
```

The CLI's create result is derived from the confirmed `ProposalCreated` receipt and subsequent contract readback. Both independent members commit before the live commit deadline; each keeps its own mode-0600 ballot file. A commit/reveal ballot hides the choice only until reveal; wallet identity and choice become linkable on reveal.

For encrypted-keystore commit/reveal, the CLI simulates first and verifies the alias address against the selected wallet. Use the explicit voter address for every step:

```sh
bun run robinhood:mainnet:dao2:operator commit-vote <PROPOSAL_ID> for "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-ballot.json" --voter-address <PARTICIPANT_A>
bun run robinhood:mainnet:dao2:operator commit-vote <PROPOSAL_ID> for "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-ballot.json" --voter-address <PARTICIPANT_A> --execute --authorize-mainnet-dao2-write=mainnet-dao2-commit-vote --account-alias gyevo-rh-mainnet-wallet-a
bun run robinhood:mainnet:dao2:operator commit-vote <PROPOSAL_ID> for "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-ballot.json" --voter-address <PARTICIPANT_B> --execute --authorize-mainnet-dao2-write=mainnet-dao2-commit-vote --account-alias gyevo-rh-mainnet-wallet-b
```

The second command form shown is execution-only; simulate each wallet's command first. Wait for the actual on-chain 3,600-second commit period, then each wallet separately simulates and reveals using its saved ballot file. Do not lose the files: reveal requires the original salt. Wait for the actual 3,600-second reveal period, then call the UI's finalize action only when `proposalState` permits it. Execute only after quorum 2, approval, and the contract's execution window are confirmed. Proposal creation, membership registration, finalization and execution remain wallet transactions and require separate operator/owner decisions. Never claim Proposal #1 from Testnet is a Mainnet transaction.

The deployed Mainnet contract sets `startAt = createdAt + 60s`; with 3,600-second commit and reveal periods, the reveal deadline and earliest finalization time are `createdAt + 7,260s` (2 hours 1 minute). Execution requires a successful finalization transaction after that deadline and a separate execution transaction; use the live proposal readback to capture the exact actual timestamps and state. No Mainnet proposal exists in the verified evidence currently available, so there is no calendar completion time to report yet.

For encrypted aliases, repeat each reveal once without execution flags first. Then execute with the matching voter alias; after the live reveal deadline, finalize and execute separately with the admin alias:

```sh
bun run robinhood:mainnet:dao2:operator reveal-vote "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-a-ballot.json" --voter-address 0xdB354254bF1E0374963600811D1fF5643a56A367 --execute --authorize-mainnet-dao2-write=mainnet-dao2-reveal-vote --account-alias gyevo-rh-mainnet-wallet-a
bun run robinhood:mainnet:dao2:operator reveal-vote "$HOME/.local/share/gyevo-witnesses/mainnet-wallet-b-ballot.json" --voter-address 0xc70865Ec508E6A1C55E6a3E6aB60533ef57286b8 --execute --authorize-mainnet-dao2-write=mainnet-dao2-reveal-vote --account-alias gyevo-rh-mainnet-wallet-b
bun run robinhood:mainnet:dao2:operator finalize-proposal "$PROPOSAL_ID"
bun run robinhood:mainnet:dao2:operator finalize-proposal "$PROPOSAL_ID" --execute --authorize-mainnet-dao2-write=mainnet-dao2-finalize-proposal --account-alias gyevo-rh-mainnet-admin
bun run robinhood:mainnet:dao2:operator execute-proposal "$PROPOSAL_ID"
bun run robinhood:mainnet:dao2:operator execute-proposal "$PROPOSAL_ID" --execute --authorize-mainnet-dao2-write=mainnet-dao2-execute-proposal --account-alias gyevo-rh-mainnet-admin
bun run robinhood:mainnet:dao2:operator proposal "$PROPOSAL_ID"
```

## 6. Mainnet frontend publication

Only after confirming each public value against current chain 4663 readbacks, set these **public** Vercel Production variables and redeploy the web app:

```text
NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_REPUTATION_REGISTRY_CONTRACT=0x0329f0c47a7e2d390b0593fe3f3348b4c467158c
NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_GOVERNANCE_CONTRACT=0x0d543953a62a932ca687b160a59b8950af52c252
```

The base Mainnet Lending registry is receipt-derived in the typed repository registry; do not paste Testnet addresses into Mainnet variables. Do not configure signer or issuer keys in Vercel. After deployment, check `/lending`, `/dao`, and `/contracts`: chain 4663 selected only by the user, live addresses and dependencies match, Mainnet Lending and Phase 2 pause states match live RPC, credentials/scores are wallet-specific, and transaction buttons remain blocked while paused or otherwise ineligible. Confirm existing Testnet routes still resolve chain 46630 and its own registry.

## Remaining approval gates

- Owner/PM: approve the two candidate synthetic prices or provide alternatives; verify participant gas balances and confirm the already-minted allocations; accept or reject the disclosed privileged administrator/risk issuer trust model for this restricted recording. Do not repeat the confirmed token mints.
- Oracle updater: separately approved price writes.
- Demo minter / credential issuer: no action is needed for the owner-reported existing mint and Policy 3 credential state; only investigate discrepancies after live readback.
- Pause authority: separately approved Lending unpause only after the fresh live gate passes.
- Each participant wallet: its own approvals, lending actions, membership registration, commit and reveal (browser wallet or matching encrypted Foundry alias).
- Reputation issuer and admin: separately approved claims and Phase 2 activations.

Current live RPC access must be restored and all read-only statuses re-run before this workflow can be simulated against the deployed contracts. This file is not deployment authorization or a claim that the browser wallet flow has passed.
