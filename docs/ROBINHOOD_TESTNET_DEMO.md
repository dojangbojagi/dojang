# Robinhood Chain Testnet Protocol Demo

Status: deployment preparation only; no project contracts are deployed and no testnet transaction has been broadcast. Updated 2026-10-12.

## Network and scope

Robinhood Chain Testnet is chain `46630`, uses ETH for gas, and publishes `https://rpc.testnet.chain.robinhood.com` as its public RPC. Its official explorer is `https://explorer.testnet.chain.robinhood.com`. Robinhood describes the network as EVM-compatible and lists Foundry among supported tools. The public RPC is rate limited; use a dedicated provider for a longer demonstration. See the [network connection guide](https://docs.robinhood.com/chain/connecting/), [Foundry deployment guide](https://docs.robinhood.com/chain/deploy-smart-contracts/), and [testnet wallet configuration](https://docs.robinhood.com/chain/add-network-to-wallet/).

The demo uses project-owned `RobinhoodDemoCredentialRegistry`, `RobinhoodGovernancePhase1`, `EligibilityVerifierAdapter`, generated Honk verifier, controlled test oracle, demo tokens, and `LendingPoolV2`. Official GIWA Dojang and EAS are external GIWA Sepolia infrastructure. They are not part of the Robinhood authorization flow. A credential issued here is a **project-issued test credential**, and the oracle prices are **operator-controlled synthetic test prices**. Neither represents official Dojang verification or market pricing.

## Implementation boundary

- The circuit remains chain agnostic. Its public inputs already bind the subject wallet, project commitment, policy/version/threshold, credential version/expiry, chain ID, and exact V2 pool address.
- GIWA `DemoCredentialRegistry` remains pinned to chain `91342`; the separate `RobinhoodDemoCredentialRegistry` is pinned to `46630`. `LendingPoolV2` permits only those two testnets. The V2 proof check still compares the submitted chain ID to `block.chainid`; proof verification remains mandatory for supply, collateral activation, and borrow.
- `RobinhoodGovernancePhase1` is separately versioned and pinned to chain `46630`. It uses policy `4` in the project-owned Robinhood registry; Lending V2 remains policy `3`. It does not use or imply official Dojang verification, and its Phase 1 action does not control Lending parameters.
- The new Robinhood proof-context helper builds chain `46630` context and validates all nine public inputs. Existing GIWA helpers and query keys retain their GIWA defaults.
- V2 read adapters accept an explicit expected chain. Omitting it continues to mean GIWA Sepolia.
- The `robinhood_testnet` Foundry profile pins Solidity `0.8.28`, Prague EVM, optimizer settings, and chain `46630`. The deployment script refuses every other chain, including Robinhood Mainnet `4663`.
- The app now registers Robinhood Testnet as primary and keeps GIWA separately available for the official Dojang/DAO and legacy V1/Vault paths. Lending V2 hooks, issuer flow, proof context, chain-specific address resolver, query keys, explorer links and `/contracts` RH evidence use chain `46630`. Visual layout/styles were not redesigned. All RH writes remain disabled while the RH deployment outputs are unset.

## Deployment dependencies and order

Use separate Robinhood accounts and environment fields. Do not copy any GIWA address into an `RH_TESTNET_*` field.

1. Set `RH_TESTNET_RPC_URL`, distinct `RH_TESTNET_ADMIN_ADDRESS` and `RH_TESTNET_ISSUER_ADDRESS`, and every explicit governance and demo-market parameter in `.env`. Keep signers in a protected Foundry account or hardware wallet; never put a private key in `.env` or `.env.example`.
2. Build the circuit/verifier artifact and Solidity sources with the Robinhood profile:

   ```sh
   FOUNDRY_PROFILE=robinhood_testnet bun run contracts:build
   ```

3. Independently simulate the verifier deployment, which deploys both libraries and links them into HonkVerifier and `EligibilityVerifierAdapter`:

   ```sh
   bun run robinhood:verifier:simulate
   ```

4. Simulate the complete dependency-ordered stack without requiring an existing verifier deployment:

   ```sh
   bun run robinhood:stack:simulate
   ```

   The wrapper rejects broadcast, resume, signer, and verification flags. Reserve limits, interest parameters, price bounds, and governance parameters are explicit inputs; local fixture values are demonstration settings only and are not production recommendations. The controlled oracle configures bounds but leaves prices unset. Simulated addresses are temporary and are not deployment records.

5. `bun run robinhood:testnet:simulate` remains a partial path for a deployment where the Robinhood HonkVerifier already has code.
6. Only after separate deployment authorization, record addresses and successful receipts from Robinhood RPC, verify code and dependency links, and then fill `RH_TESTNET_*_ADDRESS` and `NEXT_PUBLIC_ROBINHOOD_*_CONTRACT` fields. Never copy simulated addresses into those fields.
7. Verify source using Blockscout. For example, after the registry receipt is confirmed:

   ```sh
   cd contracts
   forge verify-contract "$RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS" \
     src/RobinhoodDemoCredentialRegistry.sol:RobinhoodDemoCredentialRegistry \
     --chain-id 46630 \
     --rpc-url "$RH_TESTNET_RPC_URL" \
     --verifier blockscout \
     --verifier-url https://explorer.testnet.chain.robinhood.com/api/
   ```

   Verify Governance and Lending V2 along with linked verifier libraries and constructor-bearing contracts against the exact compiler settings, arguments, and library addresses from actual receipts. An explorer listing alone is not deployment evidence.

The simulation commands do not deploy contracts, broadcast transactions, or perform explorer verification.

## Test journey after deployment

1. Fund the deployment admin, independent issuer, proposal participants, supplier, and borrower with test ETH for their own network transactions. Robinhood's [testnet support page](https://robinhood.com/us/en/support/articles/robinhood-chain-testnet/) points to its testnet faucet; faucet limits and availability must be checked at run time. Test ETH has no real-world value.
2. **DAO Phase 1:** the authorized issuer records policy-4 project credentials for members. A member creates a proposal changing only the DAO's `minimumRemainingValidity`; eligible members each vote once; anyone finalizes after the deadline; anyone can execute a successful, unexpired proposal. Membership rechecks expiry, revocation, and current issuer authorization. This is not official Dojang verification and does not control Lending V2 settings.
3. Admin confirms the deployed registry and V2 pool point to the Robinhood verifier, and confirms issuer role. Admin sets bounded synthetic oracle values with `setPrice`; stale, missing, or future-dated prices must continue to block risk-increasing actions.
4. Admin mints the demo lending asset to the supplier and demo collateral asset plus a repayment buffer to the borrower. These are capped project tokens, not bridged or real-value assets.
5. Issuer creates a fresh private-value/salt witness for the borrower's policy-3 project credential and computes the commitment with chain `46630` and the deployed pool address. The issuer submits `recordCredential`; the raw private value and salt are not stored on chain.
6. Borrower generates a proof from the matching witness using chain `46630`, borrower address, active credential version/expiry, policy `3 / version 1 / threshold 1000`, and exact deployed pool address. Local Barretenberg verification must pass; the on-chain verifier remains authoritative.
7. Supplier similarly obtains a project credential and proof, approves the pool, and supplies lending liquidity. Borrower approves and deposits collateral, submits a proof to enable collateral, then submits a proof to borrow.
8. Borrower repays from the demo token balance and then withdraws collateral. Supplier may withdraw available supply. Capture every transaction hash, successful receipt, emitted event, and post-transaction state from the Robinhood RPC and link it to the testnet explorer.

Repayment and safe withdrawal remain available without proof reauthorization; unsafe withdrawals are still rejected by the contract's health checks. The controlled oracle is for demonstrating these mechanics only, not for a public lending market.

## Current frontend runtime integration

The shared provider registers RH before GIWA, while GIWA-only feature hooks select 91342 explicitly. `getLendingV2ContractSet(46630)` returns only RH addresses and does not fall back to the GIWA registry. The V2 hooks use `robinhoodLendingV2ProofContextForCredential` and its validator, verify the configured registry/verifier/oracle against pool reads, and carry chain-scoped query keys. The existing `/dao` page now selects between the GIWA official-Dojang DAO and a separate Robinhood DAO client using `RobinhoodGovernancePhase1` and project credential policy 4. Its proposal feed is bounded and its query keys include chain ID. The V2 transaction path simulates, checks gas/fee headroom, requests wallet approval, waits for a successful receipt, confirms contract events/state, invalidates the RH cache, and links only to the RH explorer. `/contracts` has its own RH-only bytecode/receipt/event adapter, including DAO events. Credentials remain BOJOGAY-issued; official Dojang and the GIWA DAO remain separate.

## Validation evidence and blockers

- Official documentation currently publishes the chain ID, RPC, explorer, ETH currency, and Foundry support. It describes the public endpoint as rate limited.
- A direct read-only public RPC check returned chain ID `46630`, latest block `133680842`, gas price `10000000` wei, and `0.01` ETH each for the supplied deployer and issuer on 2026-10-12. A no-broadcast full-stack Forge simulation estimated `22447849` total gas and `0.000448957002447849` ETH at a maximum fee of `0.020000001` gwei. This is a simulation estimate, not a receipt or guaranteed transaction cost.
- The official docs describe standard EVM compatibility but do not state a specific Prague fork activation for testnet. The successful Foundry compile validates the selected compiler target locally; it does not prove the remote node accepts every Prague-specific opcode. Confirm a testnet `eth_estimateGas` call with the actual deployment initcode before broadcast.
- `FOUNDRY_PROFILE=robinhood_testnet bun run contracts:build` passed with Solidity `0.8.28` and the pinned Prague target. The full Foundry suite now has `90` passing tests, including five Robinhood governance cases; legacy GIWA governance tests remain passing.
- `bun run typecheck` and `bun run build` passed. The build prerendered all eight application routes.
- `bun run zk:conformance` passed after read-only access to the Barretenberg CRS endpoint was permitted. It accepted the valid proof and rejected under-threshold, mismatched-commitment, and wrong-wallet witnesses.
- `bun run robinhood:protocol:anvil` passed on an ephemeral local chain ID `46630`: policy-4 DAO credential, proposal, two votes, finalization and execution; proposal feed empty/populated reads, quorum/totals, and active/revoked/expired credential readback; genuine policy-3 ZK proof; Lending V2 supply, collateral, borrow, repay, withdraw and liquidation; plus invalid proof/domain rejection. This is local evidence only.
- No Robinhood project deployment is evidenced in the repository or confirmed from RPC/explorer. The two supplied public wallets currently have `0.01` test ETH each; no signed transactions were performed.
- Official Dojang verified-balance attestations/witnesses are not available through this Robinhood flow. The test journey below proves only project-issued demo eligibility.
- Public operations remain unavailable because Robinhood project contract addresses are unset. The configured Foundry account alias is missing; verify it locally with `cast wallet address --account "$RH_TESTNET_ACCOUNT"` after setting that non-secret alias, and compare the output with the expected deployer address. Enter any keystore password only into the local terminal prompt.
- Do not infer the needed ETH amount from local Anvil gas units. Obtain remote gas estimates for each deployment and transaction, include L2/L1 data fees and a safety buffer, then fund each distinct signer. No real-money funding is required or recommended for this testnet demo.

## Local validation commands

```sh
bun run contracts:test
bun run zk:conformance
bun run robinhood:protocol:anvil
bun run typecheck
bun run build
```

The Robinhood Anvil journey is local simulation only. It exercises policy-4 DAO proposal/vote/finalize/execute and the genuine policy-3 ZK proof plus supply, collateral, borrow, repay, withdrawal, interest, stale-price, invalid-proof, and liquidation paths on an ephemeral chain ID `46630`. It creates no Robinhood Testnet records.
