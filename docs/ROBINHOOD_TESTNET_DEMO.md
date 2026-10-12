# Robinhood Chain Testnet Lending V2 Demo

Status: deployment preparation only; no project contracts are deployed and no testnet transaction has been broadcast. Updated 2026-10-12.

## Network and scope

Robinhood Chain Testnet is chain `46630`, uses ETH for gas, and publishes `https://rpc.testnet.chain.robinhood.com` as its public RPC. Its official explorer is `https://explorer.testnet.chain.robinhood.com`. Robinhood describes the network as EVM-compatible and lists Foundry among supported tools. The public RPC is rate limited; use a dedicated provider for a longer demonstration. See the [network connection guide](https://docs.robinhood.com/chain/connecting/), [Foundry deployment guide](https://docs.robinhood.com/chain/deploy-smart-contracts/), and [testnet wallet configuration](https://docs.robinhood.com/chain/add-network-to-wallet/).

The demo uses only project-owned `RobinhoodDemoCredentialRegistry`, `EligibilityVerifierAdapter`, generated Honk verifier, controlled test oracle, demo tokens, and `LendingPoolV2`. Official GIWA Dojang and EAS are external GIWA Sepolia infrastructure. They are not part of the Robinhood authorization flow. A credential issued here is a **project-issued test credential**, and the oracle prices are **operator-controlled synthetic test prices**. Neither represents official Dojang verification or market pricing.

## Implementation boundary

- The circuit remains chain agnostic. Its public inputs already bind the subject wallet, project commitment, policy/version/threshold, credential version/expiry, chain ID, and exact V2 pool address.
- GIWA `DemoCredentialRegistry` remains pinned to chain `91342`; the separate `RobinhoodDemoCredentialRegistry` is pinned to `46630`. `LendingPoolV2` permits only those two testnets. The V2 proof check still compares the submitted chain ID to `block.chainid`; proof verification remains mandatory for supply, collateral activation, and borrow.
- The new Robinhood proof-context helper builds chain `46630` context and validates all nine public inputs. Existing GIWA helpers and query keys retain their GIWA defaults.
- V2 read adapters accept an explicit expected chain. Omitting it continues to mean GIWA Sepolia.
- The `robinhood_testnet` Foundry profile pins Solidity `0.8.28`, Prague EVM, optimizer settings, and chain `46630`. The deployment script refuses every other chain, including Robinhood Mainnet `4663`.
- No wallet provider or visual page was changed. The currently integrated Lending V2 hooks remain GIWA-configured; frontend changes are still needed after Claude's work is handed back.

## Deployment dependencies and order

Use separate Robinhood accounts and environment fields. Do not copy any GIWA address into an `RH_TESTNET_*` field.

1. Set `RH_TESTNET_RPC_URL`, `RH_TESTNET_ADMIN_ADDRESS`, `RH_TESTNET_ISSUER_ADDRESS`, and a protected Foundry account name. Admin and issuer must be different accounts. Never put a private key in `.env` or `.env.example`.
2. Compile the existing circuit/verifier artifact and contracts, then deploy `ZKTranscriptLib` and `RelationsLib` on chain `46630`.
3. Deploy `HonkVerifier` linked to those two Robinhood library addresses. Record its actual receipt address in `RH_TESTNET_HONK_VERIFIER_ADDRESS`. Do not reuse the GIWA verifier address.
4. Review the no-broadcast simulation with the exact Robinhood RPC and profile:

   ```sh
   bun run robinhood:testnet:simulate
   ```

   The script requires a verifier with code already present on the selected RPC. The simulation wrapper rejects broadcast, signer, and verification flags. It does not publish addresses as deployment results.
5. After a separately authorized deployment, `DeployLendingV2RobinhoodTestnet` deploys a fresh project credential registry, verifier adapter, controlled oracle, lending and collateral test tokens, and V2 pool. It grants `ISSUER_ROLE` to the separate issuer and configures bounded reserves. It intentionally does not seed prices or issue credentials.
6. Read each emitted address and successful transaction receipt back from the Robinhood RPC. Fill `RH_TESTNET_*_ADDRESS` outputs and matching `NEXT_PUBLIC_ROBINHOOD_*_CONTRACT` values only with confirmed addresses. Independently check bytecode and constructor links before using the app.
7. Verify the source using Blockscout. For example, after the registry receipt is confirmed:

   ```sh
   cd contracts
   forge verify-contract "$RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS" \
     src/RobinhoodDemoCredentialRegistry.sol:RobinhoodDemoCredentialRegistry \
     --chain-id 46630 \
     --rpc-url "$RH_TESTNET_RPC_URL" \
     --verifier blockscout \
     --verifier-url https://explorer.testnet.chain.robinhood.com/api/
   ```

   Verify linked verifier libraries and constructor-bearing contracts against the exact compiler settings, constructor arguments, and library addresses from the receipts. An explorer listing alone is not deployment evidence.

No deployment, verifier/library transaction, or explorer verification was performed for this preparation.

## Test journey after deployment

1. Fund the deployment admin, the independent issuer, the supplier, and the borrower with test ETH for their own network transactions. Robinhood's [testnet support page](https://robinhood.com/us/en/support/articles/robinhood-chain-testnet/) points to its testnet faucet; faucet limits and availability must be checked at run time. Test ETH has no real-world value.
2. Admin confirms the deployed registry and V2 pool point to the Robinhood verifier, and confirms issuer role. Admin sets bounded synthetic oracle values with `setPrice`; stale, missing, or future-dated prices must continue to block risk-increasing actions.
3. Admin mints the demo lending asset to the supplier and demo collateral asset plus a repayment buffer to the borrower. These are capped project tokens, not bridged or real-value assets.
4. Issuer creates a fresh private-value/salt witness for the borrower's policy-3 project credential and computes the commitment with chain `46630` and the deployed pool address. The issuer submits `recordCredential`; the raw private value and salt are not stored on chain.
5. Borrower generates a proof from the matching witness using chain `46630`, borrower address, active credential version/expiry, policy `3 / version 1 / threshold 1000`, and exact deployed pool address. Local Barretenberg verification must pass; the on-chain verifier remains authoritative.
6. Supplier similarly obtains a project credential and proof, approves the pool, and supplies lending liquidity. Borrower approves and deposits collateral, submits a proof to enable collateral, then submits a proof to borrow.
7. Borrower repays from the demo token balance and then withdraws collateral. Supplier may withdraw available supply. Capture every transaction hash, successful receipt, emitted event, and post-transaction state from the Robinhood RPC and link it to the testnet explorer.

Repayment and safe withdrawal remain available without proof reauthorization; unsafe withdrawals are still rejected by the contract's health checks. The controlled oracle is for demonstrating these mechanics only, not for a public lending market.

## Frontend handoff still required

Claude's return handoff should add the chain to the existing wallet connector without replacing providers; add chain-scoped registry, verifier, oracle, token, and pool configuration; use `robinhoodLendingV2ProofContextForCredential` and `isRobinhoodLendingV2ProofForContext`; pass `expectedChainId: 46630` to the market adapter; and use the Robinhood explorer URL for transaction links. The UI must label the credential as project-issued and oracle prices as synthetic. Keep the existing GIWA path and official Dojang DAO flow distinct. No frontend hook or page has been switched in this change.

## Validation evidence and blockers

- Official documentation currently publishes the chain ID, RPC, explorer, ETH currency, and Foundry support. It describes the public endpoint as rate limited.
- Direct RPC JSON-RPC checks from the current development environment could not resolve the RPC hostname (`ENOTFOUND`). Therefore live chain head, live gas price, `eth_estimateGas`, and real testnet fee budget remain unverified here.
- The official docs describe standard EVM compatibility but do not state a specific Prague fork activation for testnet. The successful Foundry compile validates the selected compiler target locally; it does not prove the remote node accepts every Prague-specific opcode. Confirm a testnet `eth_estimateGas` call with the actual deployment initcode before broadcast.
- `FOUNDRY_PROFILE=robinhood_testnet bun run contracts:build` passed with Solidity `0.8.28` and the pinned Prague target. The full Foundry suite passed with `85` tests, including seven Robinhood chain and credential-boundary tests. The GIWA registry bytecode and existing deterministic proof fixture remain unchanged.
- `bun run typecheck`, `bun run build`, and the GIWA/V2 plus Robinhood configuration adapter tests passed.
- `bun run zk:conformance` could not initialize Barretenberg because the environment could not connect to its CRS download endpoint. The Robinhood Anvil lifecycle did not start because this environment could not bind a local `127.0.0.1` listener. Therefore no chain-46630 real proof was generated and no full local lifecycle was confirmed in this run.
- No Robinhood project deployment is evidenced in the repository or confirmed from RPC/explorer during this run. Test credentials and funded-wallet availability were not confirmed.
- Official Dojang verified-balance attestations/witnesses are not available through this Robinhood flow. The test journey below proves only project-issued demo eligibility.
- The existing frontend is still GIWA-bound. Wallet support, address configuration, write actions, and Robinhood explorer links need a frontend integration pass after Claude completes its current work.
- Do not infer the needed ETH amount from local Anvil gas units. Obtain remote gas estimates for each deployment and transaction, include L2/L1 data fees and a safety buffer, then fund each distinct signer. No real-money funding is required or recommended for this testnet demo.

## Local validation commands

```sh
bun run contracts:test
bun run zk:conformance
bun run lending:v2:robinhood:anvil
bun run typecheck
bun run build
```

The Anvil journey is local simulation only. It exercises the real generated ZK proof and verifier with chain ID `46630`, plus the full supply, collateral, borrow, repay, withdrawal, interest, stale-price, and liquidation paths. It creates no Robinhood Testnet records.
