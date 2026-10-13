# Robinhood Testnet Demo Bootstrap and Runbook

Status checked 2026-10-13 against Robinhood Testnet RPC (chain 46630; latest deployment/readiness read block 134142707, wallet/status read block 134132955): all ten contracts remain deployed; both synthetic prices were initialized but are now stale; the designated token allocations and both policy-4 credentials are confirmed on chain. Policy 3 is missing for both participants, Lending liquidity and positions are zero, and DAO `nextProposalId` is 1. Recheck all time-sensitive state before a public write.

Robinhood Testnet is external execution infrastructure. Credentials described here are project-issued test credentials, not official GIWA Dojang/EAS attestations. The test oracle values are synthetic demo inputs, not live market prices. Lending policy 3 still requires a genuine circuit proof bound to the user, policy, chain 46630, credential version/expiry, and the deployed LendingPoolV2 address. The private witness remains with the participant and is not sent to a contract.

## Confirmed operator configuration

- Chain: Robinhood Testnet, `46630`.
- Oracle updater and token minter: admin `0x4C488dfa668A7643C4046a1952734eF875Af0d62`.
- Policy 3 and policy 4 credential issuer: `0xBE390374Ac7304A792c50EA37AB301b659a56Df7`.
- Credential registry: `0x997F3415e83fFc37c29D142fF6f1c6D624E3D3a5`.
- Controlled oracle: `0xEd60bF3276c4d520cBF81FA480435817EAD6c1E1`.
- rUSD2 (6 decimals): `0x1b52f1F2BA6CF870415e207861C6f33DD3d5Ea0F`.
- rCOL2 (18 decimals): `0xB5c97153Dca052636eD692A9e17A9698Ca70160C`.
- LendingPoolV2: `0x3FA7bdC06E4f3134E271ff9046561A6667b1718e`.
- RobinhoodGovernancePhase1: `0x011EDe60AB460AF00E082e2086D0745B6a1B23D0`.
- Live roles: registry issuer, oracle updater, and both token minter permissions read `true` for their expected role wallets.
- DAO parameters: quorum `2`, voting period `3600` seconds, execution window `604800` seconds, minimum remaining validity `0` seconds.

## Initialized synthetic oracle values

The initialized demonstration values are **rUSD2 = 1.00 WAD** and **rCOL2 = 2.00 WAD**. They match the existing local V2 E2E fixture and fit the deployed bounds: rUSD2 `0.95–1.05`; rCOL2 `0.5–4.0`. They are synthetic test inputs, not market quotes. Both are currently older than the reserve's 3,600-second limit. A refresh repeats the same value and needs separate approval for each public transaction.

At those values, 10 rCOL2 represents $20 of synthetic collateral. The reserve's 50% max LTV permits up to $10 of synthetic debt, so a 5 rUSD2 borrow is below that ceiling. The liquidation threshold is 65%; no price claim is being made about a real asset.

## Confirmed small token allocation

The following allocations were minted to two distinct participant wallets and independently read back from chain 46630:

| Wallet role | rUSD2 | rCOL2 | Purpose |
| --- | ---: | ---: | --- |
| Supplier / DAO voter 1, `0x4C488dfa668A7643C4046a1952734eF875Af0d62` | 100 | 0 | Supply liquidity and vote |
| Borrower / DAO voter 2, `0xBE390374Ac7304A792c50EA37AB301b659a56Df7` | 6 | 10 | Repay 5 rUSD2 plus short-demo interest headroom; deposit collateral; borrow; vote |
| **Total** | **106** | **10** | Far below the deployed 1,000,000-token mint caps |

The borrow amount is a suggested 5 rUSD2 and should be kept within the live `getMaxBorrowable` readback. The borrower’s 1 rUSD2 extra balance is only a repayment buffer; read the actual accrued debt before repaying. It is not a promise that 1 token covers arbitrarily long interest accrual.

Each participant needs **both** credential policies for the combined Lending and DAO demo. Policy 4 is already active for both wallets; policy 3 is still missing:

- Policy 3: each supplier/borrower needs a distinct wallet-bound project credential and matching private witness. Lending proofs use a value at or above the circuit threshold 1000; issuer input is demo test data, not an official balance observation. Proofs must be generated genuinely in the browser against the deployed pool.
- Policy 4: each DAO participant needs a project-issued policy 4 record. Robinhood Governance Phase 1 reads the current issuer-authorized credential; no policy 3 witness or ZK proof is part of DAO membership.

The minimum DAO quorum is **two distinct member addresses** because one address can vote only once per proposal. Reusing the supplier and borrower gives the minimum two participants. Keep the admin and issuer roles separate from participant wallets where possible.

## Operator sequence

### A. Wallet and Robinhood network readiness

From the repository root:

```sh
bun run robinhood:deploy:show
bun run robinhood:bootstrap status
bun run robinhood:bootstrap participant 0x4C488dfa668A7643C4046a1952734eF875Af0d62
bun run robinhood:bootstrap participant 0xBE390374Ac7304A792c50EA37AB301b659a56Df7
bun run robinhood:bootstrap refresh-price rUSD2
bun run robinhood:bootstrap refresh-price rCOL2
```

`status` reads chain ID/head, role assignments, ETH balances, oracle bounds and prices, token supply/caps, and governance parameters. `refresh-price` simulates an update of the existing synthetic value only when that asset is stale; the currently initialized prices make the original `plan`/`price` initialization commands unsuitable. `participant <wallet>`, `credential <wallet> 3|4`, and `proposal <id>` are read-only post-state checks.

Use MetaMask or Rabby in the browser wallet selector. Confirm the displayed account and chain; this demo uses only the designated A/B addresses above, and requires chain `46630`. Confirm test ETH with `status` and read token/credential state with both `participant` commands. If switching fails, record connector name, actual provider chain ID, wagmi account chain ID, required chain ID, error name, and error code. Do not treat a successful UI click as connected until the wallet and app report chain 46630. This environment cannot interact with a real browser extension.

Every command below without `--execute` is a simulation. Public writes require separate owner authorization. The guarded CLI also checks chain, roles, keystore address, interactive typed confirmation, receipt status/event, and post-state. A keystore password is entered only at the local Foundry prompt.

### B. DAO proposal initiation

Start this first so the one-hour voting period can progress while Lending is prepared. Wallet A's policy-4 credential is active; Wallet B is the second distinct eligible voter. In `/dao`, simulate a proposal to set this DAO's own `minimumRemainingValidity` to **3,600 seconds** with public description `GYEVO testnet: require 1 hour of remaining project membership validity for protected action`. It changes only the DAO's `performProtectedAction` requirement, not Lending or DAO membership rules. The supplier simulation passed; no public proposal exists (`nextProposalId = 1`). Stop at the wallet confirmation until the owner authorizes this public write.

After proposal creation is authorized and confirmed, read the actual timing:

```sh
bun run robinhood:bootstrap proposal <ID>
```

The contract applies a 60-second start delay and 3,600-second voting period. Use the returned `startAt`, `deadline`, and `executionDeadline`; do not vote early, finalize before deadline, or execute after the seven-day execution window.

### C. Policy-3 witness preparation and issuance

Wallet A and B each need their own project-issued policy-3 credential and matching private witness. Policy 4 already exists; do not issue it again. `prepare-lending` asks for the test value through hidden local input, requires at least threshold 1000, generates a random salt, and writes a wallet/policy/version/expiry/chain/pool-bound witness with restrictive file permissions. This value is project test data, not an observed Dojang balance. Keep each witness local and deliver it only to that wallet owner over a private channel.

Dry run each wallet independently:

```sh
bun run robinhood:bootstrap prepare-lending 0x4C488dfa668A7643C4046a1952734eF875Af0d62 30 .private-witnesses/supplier-policy3.json
bun run robinhood:bootstrap issue-lending .private-witnesses/supplier-policy3.json
bun run robinhood:bootstrap prepare-lending 0xBE390374Ac7304A792c50EA37AB301b659a56Df7 30 .private-witnesses/borrower-policy3.json
bun run robinhood:bootstrap issue-lending .private-witnesses/borrower-policy3.json
```

After separate owner authorization for each issuance, run the corresponding guarded command:

```sh
bun run robinhood:bootstrap issue-lending .private-witnesses/supplier-policy3.json --execute --authorize-public-testnet-write=credential-policy-3 --account-alias <ISSUER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap issue-lending .private-witnesses/borrower-policy3.json --execute --authorize-public-testnet-write=credential-policy-3 --account-alias <ISSUER_FOUNDRY_ALIAS>
```

The alias must resolve locally to issuer Wallet B. The registry receives the commitment and public metadata, never the private value or salt. Verify each successful receipt and active record:

```sh
bun run robinhood:bootstrap credential 0x4C488dfa668A7643C4046a1952734eF875Af0d62 3
bun run robinhood:bootstrap credential 0xBE390374Ac7304A792c50EA37AB301b659a56Df7 3
```

### D. Synthetic oracle refresh

The current values are rUSD2 `1.00 WAD` and rCOL2 `2.00 WAD`, within bounds `0.95–1.05` and `0.5–4.0`. They are synthetic test inputs, not market prices. Both are stale. Simulate immediately before Lending:

```sh
bun run robinhood:bootstrap refresh-price rUSD2
bun run robinhood:bootstrap refresh-price rCOL2
```

After separate owner approval for each refresh, use:

```sh
bun run robinhood:bootstrap refresh-price rUSD2 --execute --authorize-public-testnet-write=oracle-price-refresh --account-alias <DEPLOYER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap refresh-price rCOL2 --execute --authorize-public-testnet-write=oracle-price-refresh --account-alias <DEPLOYER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap status
```

The alias must resolve to admin Wallet A. The helper refuses a fresh price, checks bounds and role, simulates, then verifies receipt, event, and updated timestamp. Each price remains usable for at most 3,600 seconds.

### E. Lending supply and collateral

The confirmed balances are A: 100 rUSD2; B: 6 rUSD2 and 10 rCOL2. Do not mint again. At `/lending`, confirm wallet and chain, import that wallet's own private witness, generate the proof, and wait for local verification. The contract verifies it again for protected actions.

Wallet A approves only 100 rUSD2, then supplies 100 rUSD2. Wallet B approves only 10 rCOL2, deposits it, and enables it as collateral with its policy-3 proof. Read the pool and position before proceeding; the 50% maximum LTV and actual available liquidity determine the borrow ceiling.

### F. Borrow, interest, repay, and withdraw

With fresh prices and A's supplied liquidity, Wallet B generates a current proof and borrows at most 5 rUSD2, or the lower on-chain `getMaxBorrowable` amount. The reserve minimum is 1 rUSD2. Read debt including accrued interest before repayment; B has 6 rUSD2 total, so stop if the balance no longer covers the actual repay amount. Repay the actual debt, then withdraw available collateral. A may withdraw supplied liquidity after B repays and the pool reports it available.

After each wallet transaction, require a successful Robinhood receipt and refreshed on-chain position. Repayment and safe withdrawals remain available without credential reauthorization or fresh proof; unsafe withdrawals remain subject to the contract's health checks.

### G. DAO voting, finalization, and execution

Once the proposal's real `startAt` has passed, A and B each vote once. Two distinct voters meet quorum 2; proposal succeeds only if `forVotes > againstVotes`. Read timing and totals with:

```sh
bun run robinhood:bootstrap proposal <ID>
```

Wait for the actual on-chain `deadline`; then finalize and execute only when the state is `Succeeded`, before `executionDeadline`. No test time acceleration or manual deadline assumption is valid on Robinhood.

### H. Explorer source verification

Run the existing read-only parity and source status command:

```sh
bun run robinhood:source:plan
```

Latest preflight: all ten initcodes, successful receipts, and deployed runtimes match compiled sources. Compiler is solc `0.8.28+commit.7893614a`, Prague EVM, optimizer enabled with 200 runs. The command prints one deterministic `forge verify-contract` command per contract with constructor arguments and linked HonkVerifier libraries. Blockscout reports **0/10 verified**. Each printed command submits source to the public explorer; inspect and authorize that disclosure before running any of them. No submission has been made.

## Current blockers and approval gates

- Both participants and their token allocations are confirmed. Do not repeat minting or policy-4 issuance.
- The existing `1.00` and `2.00` synthetic prices are stale. Each guarded refresh needs separate approval and a fresh post-transaction age check; a different value needs separate risk review.
- The private policy 3 values are supplied by the issuer for demo testing. They must meet threshold 1000 and remain in private witness files; they are not official Dojang balances.
- Policy-3 issuance and oracle refresh require separate owner authorization. Each app transaction requires the relevant participant's wallet confirmation. Keystore aliases are used only for operator writes; passwords and keys are never command arguments.
- Blockscout source verification has not been submitted. Reviewing and publishing the ten source records is a separate action.

No contract was redeployed. No transaction was signed or broadcast by these tools.
