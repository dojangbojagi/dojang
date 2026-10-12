# Robinhood Testnet Demo Bootstrap and Runbook

Status: contracts are deployed on Robinhood Testnet (chain 46630). This runbook prepares optional, operator-controlled demo state. At authoring time both oracle prices and token supplies are zero, and there are no policy 3 or policy 4 credentials. No bootstrap transaction has been submitted by this runbook.

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

## Proposed synthetic oracle values

The recommended demonstration values are **rUSD2 = 1.00 WAD** and **rCOL2 = 2.00 WAD**. They match the existing local V2 E2E fixture and fit the deployed bounds: rUSD2 `0.95–1.05`; rCOL2 `0.5–4.0`. They are test inputs only. Review/approve these specific values before running the execution form of either price command.

At those values, 10 rCOL2 represents $20 of synthetic collateral. The reserve's 50% max LTV permits up to $10 of synthetic debt, so a 5 rUSD2 borrow is below that ceiling. The liquidation threshold is 65%; no price claim is being made about a real asset.

## Proposed small token allocation

Use two distinct participant wallets, with the following initial mint plan:

| Wallet role | rUSD2 | rCOL2 | Purpose |
| --- | ---: | ---: | --- |
| Supplier / DAO voter 1 | 100 | 0 | Supply liquidity and vote |
| Borrower / DAO voter 2 | 6 | 10 | Repay 5 rUSD2 plus short-demo interest headroom; deposit collateral; borrow; vote |
| **Total** | **106** | **10** | Far below the deployed 1,000,000-token mint caps |

The borrow amount is a suggested 5 rUSD2 and should be kept within the live `getMaxBorrowable` readback. The borrower’s 1 rUSD2 extra balance is only a repayment buffer; read the actual accrued debt before repaying. It is not a promise that 1 token covers arbitrarily long interest accrual.

Each participant needs **both** credential policies for the combined Lending and DAO demo:

- Policy 3: each supplier/borrower needs a distinct wallet-bound project credential and matching private witness. Lending proofs use a value at or above the circuit threshold 1000; issuer input is demo test data, not an official balance observation. Proofs must be generated genuinely in the browser against the deployed pool.
- Policy 4: each DAO participant needs a project-issued policy 4 record. Robinhood Governance Phase 1 reads the current issuer-authorized credential; no policy 3 witness or ZK proof is part of DAO membership.

The minimum DAO quorum is **two distinct member addresses** because one address can vote only once per proposal. Reusing the supplier and borrower gives the minimum two participants. Keep the admin and issuer roles separate from participant wallets where possible.

## Read-only status and simulations

From the repository root:

```sh
bun run robinhood:deploy:show
bun run robinhood:bootstrap status
bun run robinhood:bootstrap plan
```

`status` reads chain ID/head, role assignments, ETH balances, oracle bounds and prices, token supply/caps, and governance parameters. `plan` simulates the two proposed price writes from the authorized updater and estimates gas. It cannot simulate mints or credentials until actual participant addresses and (for policy 3) a witness are supplied to the individual commands. `participant <wallet>`, `credential <wallet> 3|4`, and `proposal <id>` are read-only post-state checks.

Each individual write command simulates by default. Every on-chain execution path requires `--execute`, its exact action-specific `--authorize-public-testnet-write=...` value, the expected Foundry keystore alias, and an interactive typed confirmation. The command rechecks chain ID and role, uses `cast` with the protected keystore (password entered only at its local prompt), waits for the actual receipt, checks receipt sender/target/status, validates an emitted event, and reads the resulting state. No command has a deployment or Mainnet mode.

### Oracle: simulate first, later authorize one asset at a time

```sh
bun run robinhood:bootstrap price rUSD2 1.00
bun run robinhood:bootstrap price rCOL2 2.00
```

Only after explicitly approving the synthetic demo values:

```sh
bun run robinhood:bootstrap price rUSD2 1.00 --execute --authorize-public-testnet-write=oracle-price --account-alias <DEPLOYER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap price rCOL2 2.00 --execute --authorize-public-testnet-write=oracle-price --account-alias <DEPLOYER_FOUNDRY_ALIAS>
```

The helper refuses to overwrite a nonzero current price. A later repricing is intentionally outside this one-time bootstrap path and must be reviewed separately.

### Token allocations: simulate each wallet allocation first

```sh
bun run robinhood:bootstrap mint rUSD2 <SUPPLIER_ADDRESS> 100
bun run robinhood:bootstrap mint rUSD2 <BORROWER_ADDRESS> 6
bun run robinhood:bootstrap mint rCOL2 <BORROWER_ADDRESS> 10
```

After explicit authorization of the exact allocations:

```sh
bun run robinhood:bootstrap mint rUSD2 <SUPPLIER_ADDRESS> 100 --execute --authorize-public-testnet-write=token-mint --account-alias <DEPLOYER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap mint rUSD2 <BORROWER_ADDRESS> 6 --execute --authorize-public-testnet-write=token-mint --account-alias <DEPLOYER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap mint rCOL2 <BORROWER_ADDRESS> 10 --execute --authorize-public-testnet-write=token-mint --account-alias <DEPLOYER_FOUNDRY_ALIAS>
```

The helper refuses a recipient that already has a balance or a previous mint event, and checks the deployed mint cap before simulation. Replace placeholders with owner-designated addresses; no participant address is inferred by the tool.

### Project credential issuance

Policy 4 uses a random opaque commitment and has no private witness requirement. First simulate; later issue only after explicit approval:

```sh
bun run robinhood:bootstrap issue-dao <SUPPLIER_ADDRESS> 30
bun run robinhood:bootstrap issue-dao <BORROWER_ADDRESS> 30
bun run robinhood:bootstrap issue-dao <SUPPLIER_ADDRESS> 30 --execute --authorize-public-testnet-write=credential-policy-4 --account-alias <ISSUER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap issue-dao <BORROWER_ADDRESS> 30 --execute --authorize-public-testnet-write=credential-policy-4 --account-alias <ISSUER_FOUNDRY_ALIAS>
```

Policy 3 commitments must be made together with a private witness. `prepare-lending` prompts for the private test value without echo, creates a random salt, binds the commitment to the wallet, policy 3/version 1, threshold 1000, expiry, chain 46630, and deployed pool, simulates issuance, then writes the witness as a mode-0600 file in a mode-0700 directory. The recommended `.private-witnesses/` folder is ignored by Git. Deliver each file to its wallet owner over a private channel; never paste its contents into chat, issues, logs, or public storage.

```sh
bun run robinhood:bootstrap prepare-lending <SUPPLIER_ADDRESS> 30 .private-witnesses/supplier-policy3.json
bun run robinhood:bootstrap prepare-lending <BORROWER_ADDRESS> 30 .private-witnesses/borrower-policy3.json
bun run robinhood:bootstrap issue-lending .private-witnesses/supplier-policy3.json
bun run robinhood:bootstrap issue-lending .private-witnesses/borrower-policy3.json
```

Only after explicit policy 3 issuance authorization:

```sh
bun run robinhood:bootstrap issue-lending .private-witnesses/supplier-policy3.json --execute --authorize-public-testnet-write=credential-policy-3 --account-alias <ISSUER_FOUNDRY_ALIAS>
bun run robinhood:bootstrap issue-lending .private-witnesses/borrower-policy3.json --execute --authorize-public-testnet-write=credential-policy-3 --account-alias <ISSUER_FOUNDRY_ALIAS>
```

The contract receives only the commitment and public credential metadata. Before any execution, the tool recomputes the commitment and rejects mismatches. Issuance refuses a wallet with an existing version; oracle prices refuse nonzero state; token minting refuses prior mint logs. `credential <wallet> 3|4` provides independent read-only post-state checks.

## User journey checklist

### Lending

1. Set the two synthetic prices and mint the proposed allocations after their respective approvals.
2. The issuer prepares and issues each policy 3 credential, then privately delivers the corresponding witness to the wallet owner.
3. Supplier connects on `/lending` on chain 46630, imports its own witness, generates a genuine locally verified proof, approves 100 rUSD2 to LendingPoolV2, and supplies 100 rUSD2.
4. Borrower connects on `/lending`, imports its own witness, generates a genuine proof, deposits 10 rCOL2, enables it as collateral with the required proof, reads its account data/max borrowable, and borrows no more than 5 rUSD2 or the lower on-chain limit.
5. Borrower repays based on current debt readback (including accrued interest), then withdraws collateral. Supplier withdraws supplied liquidity after checking available liquidity.

Repayment and safe withdrawals do not require fresh credentials or proofs; do not weaken this protocol behavior. A proof generated locally is not itself a chain transaction—the V2 contract verifies it again when required.

### Governance

1. Issue active policy 4 credentials to the same two distinct participants.
2. One member creates a proposal on `/dao`. For a harmless end-to-end run, use a public content reference chosen by the owner and propose the current `minimumRemainingValidity` value (`0` seconds), making execution a no-op state update.
3. Read its actual timing with `bun run robinhood:bootstrap proposal <ID>`. The contract sets `startAt = createdAt + 60 seconds` and `deadline = startAt + 3600 seconds`; do not vote before `startAt` or at/after `deadline`.
4. Both distinct credentialed wallets vote For once while the on-chain window is open. Two total votes meet quorum 2; the result still requires `forVotes > againstVotes`.
5. Wait until the recorded deadline. Any wallet may finalize after it. Execute only if the live proposal state is `Succeeded` and before its actual `executionDeadline` (seven days after deadline).

Never use local time acceleration or assume an estimated deadline. The page and `proposal` command read contract timing/state; the contract decides whether a transition is allowed.

## Source verification preparation

Run:

```sh
bun run robinhood:source:plan
```

This read-only command identifies all ten contracts from successful deployment receipts, compares each creation input with the local compiled creation bytecode and linked library addresses, checks RPC receipt and runtime bytecode against the deployed artifacts (normalizing immutable constructor locations and the Solidity library self-address), checks exact compiler metadata, and prints a `forge verify-contract` command for each address. It queries Blockscout status but does not submit source.

The current local parity check passed for all ten deployed contracts: solc `0.8.28+commit.7893614a`, Prague EVM, optimizer enabled, 200 runs. Blockscout currently reports **source not verified** for all ten; deployed code is not source verification. Commands use Foundry's documented `--libraries <source>:<library>:<address>` format and the Blockscout `/api?` endpoint. Submission is a separate public disclosure step and must be run deliberately, one contract at a time, after reviewing the printed constructor arguments and linked addresses. Foundry's references: [verification command](https://getfoundry.sh/forge/reference/verify-contract/) and [deployment and verification guide](https://getfoundry.sh/forge/deploying/).

## Current blockers and approval gates

- No supplier or borrower addresses have been designated. The commands require actual participant addresses before mint/credential simulations.
- Confirm that `1.00` and `2.00` are accepted solely as synthetic test prices, and approve the small allocation table above. No prices, tokens, or credentials were written in the preparation run.
- The private policy 3 values are supplied by the issuer for demo testing. They must meet threshold 1000 and remain in private witness files; they are not official Dojang balances.
- Public wallet signing/broadcast is not authorized by this preparation. Each set-price, mint, and credential issuance action needs separate explicit owner authorization. Keystore aliases are required only at execution time; passwords and keys are never command arguments.
- Blockscout source verification has not been submitted. Reviewing and publishing the ten source records is a separate action.

No contract was redeployed. No transaction was signed or broadcast by these tools.
