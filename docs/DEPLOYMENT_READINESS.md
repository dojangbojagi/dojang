# GIWA Sepolia Deployment Readiness

## Current status

- Target network: GIWA Sepolia, chain ID `91342`, native gas currency `ETH` ([official connection details](https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa)).
- Project-owned contracts: **not deployed**. There are no project deployment addresses or GIWA transaction receipts in the repository.
- `GovernedDojangAccess` is now implemented and locally tested; it is not included in the existing core or lending deployment transactions.
- Deployment scripts: prepared in `contracts/script/`; Foundry scripts simulate by default and only send when passed `--broadcast`.
- Local deployment gas observation: `12,059,491` EVM execution gas for nine contract deployments plus one issuer-role grant, measured with the local Anvil estimator. This is not a GIWA fee quote and does not include the rollup data fee.
- Source verification: not submitted. The GIWA Explorer is documented as Blockscout; endpoint behavior and verification results remain unconfirmed.
- Contract addresses in `.env.example` are intentionally blank until actual deployment and readback.
- The public GIWA RPC is documented as rate-limited. Use an operator-managed RPC for sustained use.

## Infrastructure boundaries and trust model

| System | Ownership and role |
| --- | --- |
| GIWA Sepolia | External execution network; chain ID `91342`; gas is paid in ETH. |
| Dojang / EAS | External attestation infrastructure. The app reads official Verified Address attestations; this does not create or grant a project `ISSUER_ROLE`. |
| Bojagi | Conceptual privacy reference only; no private-transfer protocol is implemented here. |
| Generated Honk verifier and EligibilityVerifierAdapter | Project-owned ZK proof verification. |
| RestrictedVault | Project-owned, proof-gated access flag; it does not custody funds. |
| LendingPool and ControlledTestToken | Project-owned fixed-price lending demo and capped test assets; not production lending. |
| GIWA Explorer | External public evidence view. Its network-wide transaction, address, and fee totals must never be reported as application activity. |

The Dojang integration uses GIWA’s documented `DojangScroll`, `DojangAttesterBook`, EAS, Upbit Korea attester ID, and Verified Address schema ([official Dojang contract table](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts)). The frontend and governance contract resolve the trusted attester with `getAttester(attesterId)` instead of relying on a copied issuer value. The documentation's displayed Upbit Korea address omits a leading zero nibble; the padded EVM address in the app is `0x04097bf3Cb731AEb3e501b910b33B2Af9Fa68E38`. The RPC could not be queried from this environment to independently read the attester book, so confirm that mapping during live preflight.

## Contract graph and deployment parameters

Deploy the two generated-verifier libraries before the verifier. Then deploy the shared registry, verifier adapter, vault, two demo assets, and lending pool. The core and lending Foundry scripts are separate so neither script embeds the entire verifier creation bytecode or exceeds the EIP-170 runtime limit.

| Contract | Constructor / setup | Trust and dependency notes |
| --- | --- | --- |
| `ZKTranscriptLib` | No constructor arguments | Project-owned linked library for the generated verifier. |
| `RelationsLib` | No constructor arguments | Project-owned linked library for the generated verifier. |
| `HonkVerifier` | No constructor arguments; link both libraries | Generated from the repository’s current circuit verifier source. Record both library addresses and use them in source verification. |
| `DemoCredentialRegistry` | No constructor arguments | The deploying admin receives `DEFAULT_ADMIN_ROLE`. `ISSUER_ROLE` is initially empty. |
| `EligibilityVerifierAdapter` | `HonkVerifier` address | Shared by the vault and lending pool. It returns false when generated proof verification reverts. |
| `RestrictedVault` | Registry, verifier adapter | Fixed policy `1`, version `1`, threshold `1,000`; access is permanent once granted. |
| `ControlledTestToken` lending asset | `("GIWA Demo Lending Dollar", "gUSD", 6, 10^15, admin)` | Capped at `10^15` base units; total supply starts at zero. Admin receives minter and admin roles. |
| `ControlledTestToken` collateral asset | `("GIWA Demo Collateral", "gCOL", 18, 10^27, admin)` | Capped at `10^27` base units; total supply starts at zero. Admin receives minter and admin roles. |
| `LendingPool` | Same registry, same verifier adapter, lending asset, collateral asset | Requires both distinct assets to have code and the controlled-demo marker. Fixed 1:1 price, 50% LTV, zero interest; no oracle or liquidation. |
| `GovernedDojangAccess` | Official DojangScroll, DojangAttesterBook, EAS, Upbit Korea attester ID, Verified Address schema UID, voting period, absolute quorum, execution window, initial minimum remaining validity | Independent of the project credential registry and ZK verifier. Proposal/vote membership is checked live through official Dojang/EAS. The only executable action changes the policy consumed by this contract's `performProtectedAction`; there is no arbitrary call path. |

The registry accepts nonzero policy IDs and issuer-authorized commitments. The demo vault checks policy `1`; the lending pool checks policy `2`, version `1`, threshold `1,000`, current issuer authorization, expiry, revocation, chain ID, and the proof’s vault field bound to the pool address. Credential records store commitments, not private values or salts. Dojang credentials do not implicitly issue these project registry records.

Use a distinct admin and trusted issuer address. The admin controls registry roles and token minting; the issuer receives only `ISSUER_ROLE` in the registry. Review the exact issuer address before any broadcast.

## Reproducible deployment sequence

These commands are templates for a later, separately authorized deployment. Do not add a private key to a command or file. Use a protected Foundry keystore (`--account`) or a supported hardware signer. `forge create` and `forge script` are simulations unless `--broadcast` is supplied.

Set only public deployment inputs in the shell:

```sh
export GIWA_RPC_URL="https://sepolia-rpc.giwa.io"
export GIWA_ACCOUNT="<Foundry keystore name>"
export GIWA_ADMIN_ADDRESS="0x..."
export GIWA_ISSUER_ADDRESS="0x..."
export GIWA_GOVERNANCE_VOTING_PERIOD="604800"
export GIWA_GOVERNANCE_QUORUM="2"
export GIWA_GOVERNANCE_EXECUTION_WINDOW="604800"
export GIWA_GOVERNANCE_INITIAL_MIN_VALIDITY="0"
```

1. Build and run local regressions first: `bun run contracts:build`, `bun run contracts:test`, `bun run lending:anvil`, and `bun run deployment:gas-local`.
2. Check the live endpoint reports chain ID `91342`, the selected sender matches `GIWA_ADMIN_ADDRESS`, and the admin has enough test ETH for the live per-transaction fee estimates.
3. Simulate deployment of the linked verifier libraries:

   ```sh
   forge create --root contracts --use contracts/solc-wrapper.sh \
     src/generated/EligibilityHonkVerifier.sol:ZKTranscriptLib \
     --rpc-url "$GIWA_RPC_URL" --account "$GIWA_ACCOUNT" --sender "$GIWA_ADMIN_ADDRESS"
   forge create --root contracts --use contracts/solc-wrapper.sh \
     src/generated/EligibilityHonkVerifier.sol:RelationsLib \
     --rpc-url "$GIWA_RPC_URL" --account "$GIWA_ACCOUNT" --sender "$GIWA_ADMIN_ADDRESS"
   ```

   Capture each address. Add `--broadcast` only when the deployment has been authorized.
4. Deploy `HonkVerifier` with both linked library addresses:

   ```sh
   forge create --root contracts --use contracts/solc-wrapper.sh src/generated/EligibilityHonkVerifier.sol:HonkVerifier \
     --rpc-url "$GIWA_RPC_URL" --account "$GIWA_ACCOUNT" --sender "$GIWA_ADMIN_ADDRESS" \
     --libraries "src/generated/EligibilityHonkVerifier.sol:ZKTranscriptLib:<address>" \
     --libraries "src/generated/EligibilityHonkVerifier.sol:RelationsLib:<address>"
   ```

   Capture the verifier address as `GIWA_HONK_VERIFIER_ADDRESS`; add `--broadcast` only for the authorized deployment.
5. Simulate the core deployment. The script deploys the registry, adapter, and vault, then grants the chosen issuer role:

   ```sh
   export GIWA_HONK_VERIFIER_ADDRESS="0x..."
   forge script --root contracts --use contracts/solc-wrapper.sh script/DeployGIWASepolia.s.sol:DeployGIWASepolia \
     --rpc-url "$GIWA_RPC_URL" --account "$GIWA_ACCOUNT" --sender "$GIWA_ADMIN_ADDRESS"
   ```

   Only an explicitly authorized broadcast should add `--broadcast`. Record the registry, adapter, and vault addresses and transaction receipts.
6. Simulate the lending stage using those actual core addresses:

   ```sh
   export GIWA_CREDENTIAL_REGISTRY_ADDRESS="0x..."
   export GIWA_VERIFIER_ADAPTER_ADDRESS="0x..."
   forge script --root contracts --use contracts/solc-wrapper.sh script/DeployLendingGIWASepolia.s.sol:DeployLendingGIWASepolia \
     --rpc-url "$GIWA_RPC_URL" --account "$GIWA_ACCOUNT" --sender "$GIWA_ADMIN_ADDRESS"
   ```

   Only an explicitly authorized broadcast should add `--broadcast`. Record the token and pool addresses and all receipts. Do not use addresses printed by a simulation as deployed addresses.
7. Simulate the separate governance deployment with the standard official Dojang configuration:

   ```sh
   forge script --root contracts --use contracts/solc-wrapper.sh script/DeployGovernanceGIWASepolia.s.sol:DeployGovernanceGIWASepolia \
     --rpc-url "$GIWA_RPC_URL" --account "$GIWA_ACCOUNT" --sender "$GIWA_ADMIN_ADDRESS"
   ```

   The script rejects missing official contract code, fixes the external Dojang addresses/attester ID/schema UID, and requires a voting period of at least one hour. It simulates by default; add `--broadcast` only after separate explicit authorization. Record the DAO address and deployment receipt. Its constructor has no registry, demo issuer, ZK verifier, vault, or lending dependency.
8. Read back every address, constructor link, issuer role, token cap, decimals, pool constants, governance parameters, Dojang mapping, and official credential status from GIWA RPC before configuring the app.

`contracts/script/DeployGIWASepolia.s.sol`, `contracts/script/DeployLendingGIWASepolia.s.sol`, and `contracts/script/DeployGovernanceGIWASepolia.s.sol` enforce chain ID `91342`. They do not contain keys. Library linking remains an explicit input to `forge create` and explorer verification. The governance script does not accept fixture or demo credential addresses.

## Source verification and explorer evidence

GIWA [documents its Sepolia explorer as Blockscout](https://docs.giwa.io/giwa-chain/en/tools/block-explorers). Foundry supports Blockscout verification with a custom verifier URL; its [documented URL convention](https://getfoundry.sh/reference/common/verifier-options) appends `/api?` to the explorer origin. The expected submission endpoint is therefore `https://sepolia-explorer.giwa.io/api?`, but it has not been tested or submitted from this environment.

After deployment, verify each library and contract against the same compiler input used for deployment: Solidity `0.8.28`, optimizer enabled with `200` runs, current repository remappings, and EVM target `prague` (the current build artifact metadata). Use these common read-only compiler options for `forge verify-contract`:

```sh
VERIFY_ARGS=(--root contracts --use contracts/solc-wrapper.sh \
  --verifier blockscout --verifier-url 'https://sepolia-explorer.giwa.io/api?' \
  --chain-id 91342 --compiler-version v0.8.28+commit.7893614a \
  --num-of-optimizations 200 --watch --evm-version prague)
```

For example, a no-argument registry verification and the linked verifier verification are:

```sh
forge verify-contract "${VERIFY_ARGS[@]}" "$GIWA_REGISTRY_ADDRESS" \
  src/DemoCredentialRegistry.sol:DemoCredentialRegistry
forge verify-contract "${VERIFY_ARGS[@]}" \
  --libraries "src/generated/EligibilityHonkVerifier.sol:ZKTranscriptLib:$GIWA_ZK_TRANSCRIPT_LIB_ADDRESS" \
  --libraries "src/generated/EligibilityHonkVerifier.sol:RelationsLib:$GIWA_RELATIONS_LIB_ADDRESS" \
  "$GIWA_HONK_VERIFIER_ADDRESS" src/generated/EligibilityHonkVerifier.sol:HonkVerifier
```

Use `cast abi-encode 'constructor(...)' ...` to supply the exact constructor byte encoding for contracts that take arguments. The remaining constructor values are:

- `HonkVerifier`: both `--libraries` arguments and no constructor arguments.
- `EligibilityVerifierAdapter`: ABI-encoded constructor address for `HonkVerifier`.
- `RestrictedVault`: ABI-encoded registry and adapter addresses.
- Each `ControlledTestToken`: exact name, symbol, decimals, cap, and admin constructor values above.
- `LendingPool`: ABI-encoded registry, adapter, and both asset addresses.
- `GovernedDojangAccess`: official DojangScroll, DojangAttesterBook, EAS, attester ID, Verified Address schema UID, voting period, quorum, execution window, and initial minimum remaining validity.
- `DemoCredentialRegistry` and the two libraries: no constructor arguments.

Verify source only after the deployment record is complete. If Blockscout rejects the custom API endpoint, use its contract verification page with the Foundry standard JSON compiler input; do not mark verification complete until the explorer shows an exact match.

## Environment configuration after verified deployment

Only fill these existing `.env` / `.env.local` entries after on-chain readback:

```dotenv
NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT=0x...
NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT=0x...
NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT=0x...
NEXT_PUBLIC_LENDING_POOL_CONTRACT=0x...
NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT=0x...
```

`NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT` points to `EligibilityVerifierAdapter`. The adapter exposes the generated verifier address on-chain. `LendingPool` exposes its token addresses on-chain; token addresses do not need separate frontend environment entries. Never configure local Anvil addresses as GIWA contracts. The public RPC is rate-limited; use an operator-managed endpoint for sustained app traffic.

## On-chain evidence interfaces

Existing hooks already use GIWA RPC reads for registry records, Dojang/EAS data, vault access, and lending balances/positions. Credential, vault, and lending write hooks simulate, submit, wait for receipts, and perform state readback. Their `TransactionLifecycle` states remain `idle`, `simulating`, `awaiting-signature`, `submitted`, `confirming`, `confirmed`, `reverted`, `rejected`, and `rpc-error`.

The new read-only service at [`chain-evidence.ts`](../src/lib/protocol/chain-evidence.ts) provides:

- `inspectProjectDeployment(client)`: reports configured addresses, whether runtime code exists, runtime code hashes, and actual registry/verifier/token links read from the deployed contracts. A code hash is not a source-verification claim.
- `readProjectTransactionEvidence(client, hash)`: retrieves a real receipt and filters its logs to configured project contracts.
- `readProjectProtocolLogs(client, { fromBlock, toBlock })`: scans an explicit block range for configured project contracts and the lending assets discovered through the pool. The range is chunked; the output is not a network-wide count.
- `protocolEventAbi(contract)`: returns the event ABI for decoding raw log topics and data. Credential committed/revoked and role grant/revoke events are now included in the registry ABI.

The DAO adapter at [`service.ts`](../src/lib/governance/service.ts) reads governance parameters, official Dojang membership, proposal state/counts, and bounded `ProposalCreated` event ranges. `useDaoGovernance` simulates every write, waits for a receipt, and verifies a proposal/vote/finalization/execution/protected-action readback. DAO events are project-owned evidence only after a real governance address is configured.

The adapter requires chain `91342`; unconfigured addresses stay unconfigured. Caller-supplied block ranges determine log coverage. Store the deployment block and transaction receipts when available so later scans can start at the correct block. For application usage statistics, derive counts only from project contract events and state. Do not use GIWA-wide transaction counts, address counts, gas totals, or explorer charts as product activity.

## Local deployment gas observation

`bun run deployment:gas-local` deploys the exact artifact graph to a temporary local Anvil node and reports EVM execution gas. The current observation was:

| Transaction | Gas used |
| --- | ---: |
| `ZKTranscriptLib` deployment | 1,383,456 |
| `RelationsLib` deployment | 1,777,166 |
| `HonkVerifier` deployment | 4,064,305 |
| Registry deployment | 722,855 |
| Adapter deployment | 228,234 |
| Restricted Vault deployment | 461,820 |
| gUSD demo token deployment | 857,688 |
| gCOL demo token deployment | 857,676 |
| LendingPool deployment | 1,654,807 |
| Registry issuer-role grant | 51,484 |
| **Total local execution gas** | **12,059,491** |

This is a local execution-gas baseline, not the ETH balance requirement. GIWA is an OP Stack L2; the actual total includes the live L2 execution price and rollup data fee. The GIWA RPC could not be resolved from this environment, so no current fee quote or remote `eth_estimateGas` result is claimed. Before deployment, quote each transaction against GIWA RPC, total the actual fees including L1 data fees, and fund the admin with an explicit safety buffer. GIWA documents a 60 million block gas limit in its [Ethereum differences guide](https://docs.giwa.io/giwa-chain/en/network-information/diffs-ethereum-giwa); this does not guarantee the transaction estimate or fee.

The current artifacts target `prague`, while the official GIWA network docs do not state the active EVM fork in the connection guide. Confirm the compiled deployment bytecode with GIWA `eth_estimateGas` before broadcast. If the target must change, rebuild all contracts and scripts and rerun proof conformance; the lending fixture binds the verifier target address and may need regeneration.

GIWA’s [published faucet documentation](https://docs.giwa.io/get-started/faucets) lists 0.005 test ETH per 24 hours for the GIWA Faucet and 0.01 test ETH per 24 hours for the Nodit Faucet. Availability and limits can change; check the current official faucet page. Do not assume a faucet claim covers the deployment budget.

## Final wallet testing procedure

Use separate admin, credential issuer, supplier, borrower, and (if needed) a second borrower wallets. These are roles for a later, authorized test; no transaction is sent by this checklist.

1. Confirm chain ID `91342`; inspect all project code and constructor links using `inspectProjectDeployment`; inspect each deployment receipt and explorer entry.
2. Read back `DEFAULT_ADMIN_ROLE`, `ISSUER_ROLE`, and both token `MINTER_ROLE`s. Confirm the issuer is the reviewed address and differs from the admin.
3. From the admin, mint small capped demo balances to the supplier and borrower test wallets. Confirm token decimals, balance, cap, and `Transfer` receipts.
4. Connect the issuer wallet and issue a policy `1` credential for the vault flow, then confirm registry state and `CredentialCommitted` receipt logs. Generate and locally verify the proof, enter the vault, then verify `VaultAccessGranted`, `hasAccess`, and the receipt on the explorer.
5. For lending, issue a separate policy `2` credential with the existing lending credential hook. The issuer must currently hold `ISSUER_ROLE`. Generate a proof bound to the exact pool address; approve and supply gUSD, approve and deposit gCOL, borrow within the fixed 50% LTV, repay, and withdraw collateral and supplier liquidity.
6. After each write, require a successful receipt, expected event, and contract-state readback. Exercise a wrong proof, wrong wallet, revoked/expired credential, and over-capacity borrow using disposable test accounts; expected failures must remain failures.
7. Save the real address manifest, transaction hashes, block numbers, code-verification links, issuer/admin addresses, and test receipts. Clearly label any action never performed.

## Remaining blockers

1. No live GIWA RPC connectivity from this execution environment: chain ID, current fee quote, remote gas estimates, on-chain role/config readback, and attester-book readback are unverified here.
2. No real deployment addresses, deployment transactions, or source-verification submissions exist; the app remains unconfigured.
3. The Blockscout verification API endpoint and exact-source result have not been tested.
4. GIWA's currently active EVM fork has not been confirmed against the current `prague` compiler target.
5. Wallet testing on GIWA Sepolia remains pending deployment and funding. Local Anvil evidence is not a substitute.
