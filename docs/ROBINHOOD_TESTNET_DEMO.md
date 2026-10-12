# Robinhood Chain Testnet Protocol Demo

Status: full protocol stack deployed to Robinhood Chain Testnet (chain 46630) on 2026-10-12. All 10 contract creation receipts and 5 initialization receipts are successful. Lending bootstrap transactions and user journeys have not yet been run. Source verification is still pending for all 10 contracts.

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
- The app registers Robinhood Testnet as primary and keeps GIWA separately available for official Dojang and legacy V1/Vault paths. The confirmed deployment addresses populate the isolated RH registry and frontend outputs. DAO/Lending hooks use the chain-46630 registry; live writes still depend on wallet/network checks and contract bootstrap state. Oracle prices are currently unset, so risk-increasing Lending actions remain blocked.

## Confirmed deployment registry

Read-only verification used `contracts/broadcast/DeployRobinhoodProtocolStack.s.sol/46630/run-latest.json` and Robinhood RPC. All 15 receipts succeeded, all 10 receipt addresses have nonempty bytecode, HonkVerifier creation bytecode matches the generated artifact linked to the deployed libraries, and constructor dependencies, roles, token identities, oracle bounds, and both reserve configurations were read back. The generated `HonkVerifier` name was confirmed by creation bytecode because Foundry omitted its contract name in the broadcast artifact.

| Contract | Address | Successful creation transaction |
|---|---|---|
| ZKTranscriptLib | [`0xa8e694A6449237a6deE4EC3847D11c2d9b484B21`](https://explorer.testnet.chain.robinhood.com/address/0xa8e694A6449237a6deE4EC3847D11c2d9b484B21) | [`0x8c989d6e6e96c28135006378b2906e7070b6e9b6ed280c0baa714ae1bc914e50`](https://explorer.testnet.chain.robinhood.com/tx/0x8c989d6e6e96c28135006378b2906e7070b6e9b6ed280c0baa714ae1bc914e50) |
| RelationsLib | [`0xfa7674DEFbE554477176628AD8aB36Fe5d8b83E5`](https://explorer.testnet.chain.robinhood.com/address/0xfa7674DEFbE554477176628AD8aB36Fe5d8b83E5) | [`0x881886489ac913f586976a385b1d1cd86511da51e0dc08c671cada3436dd65af`](https://explorer.testnet.chain.robinhood.com/tx/0x881886489ac913f586976a385b1d1cd86511da51e0dc08c671cada3436dd65af) |
| HonkVerifier | [`0xEEB12913D55bfFd1DE762BDe4250c5f0B0072D61`](https://explorer.testnet.chain.robinhood.com/address/0xEEB12913D55bfFd1DE762BDe4250c5f0B0072D61) | [`0xdd5c87358456066b021f7aa43ed8a1f5571b334ca61d4593e000c8f0b2fc0b8e`](https://explorer.testnet.chain.robinhood.com/tx/0xdd5c87358456066b021f7aa43ed8a1f5571b334ca61d4593e000c8f0b2fc0b8e) |
| EligibilityVerifierAdapter | [`0x069C8C36a426Be42fC227aD5eEc7c6772BFA191b`](https://explorer.testnet.chain.robinhood.com/address/0x069C8C36a426Be42fC227aD5eEc7c6772BFA191b) | [`0xac2a7a8093de7b3c385d5c186c2a28288516dfe7536c73cf4b34bee07ae15f84`](https://explorer.testnet.chain.robinhood.com/tx/0xac2a7a8093de7b3c385d5c186c2a28288516dfe7536c73cf4b34bee07ae15f84) |
| RobinhoodDemoCredentialRegistry | [`0x997F3415e83fFc37c29D142fF6f1c6D624E3D3a5`](https://explorer.testnet.chain.robinhood.com/address/0x997F3415e83fFc37c29D142fF6f1c6D624E3D3a5) | [`0xd255b13cab526a1d9a759b3af7da503e6662aea4f5d0dd54690d2ab5c470656e`](https://explorer.testnet.chain.robinhood.com/tx/0xd255b13cab526a1d9a759b3af7da503e6662aea4f5d0dd54690d2ab5c470656e) |
| ControlledTestOracle | [`0xEd60bF3276c4d520cBF81FA480435817EAD6c1E1`](https://explorer.testnet.chain.robinhood.com/address/0xEd60bF3276c4d520cBF81FA480435817EAD6c1E1) | [`0x443b16277ebac511d3f213b6ddb302e08767c160ff89072b625957f4d22db480`](https://explorer.testnet.chain.robinhood.com/tx/0x443b16277ebac511d3f213b6ddb302e08767c160ff89072b625957f4d22db480) |
| rUSD2 | [`0x1b52f1F2BA6CF870415e207861C6f33DD3d5Ea0F`](https://explorer.testnet.chain.robinhood.com/address/0x1b52f1F2BA6CF870415e207861C6f33DD3d5Ea0F) | [`0x1d740e83f6938034bba2f5bc5c16c54cd6fc20cf9c96cfdc5ea19b00dd7c2855`](https://explorer.testnet.chain.robinhood.com/tx/0x1d740e83f6938034bba2f5bc5c16c54cd6fc20cf9c96cfdc5ea19b00dd7c2855) |
| rCOL2 | [`0xB5c97153Dca052636eD692A9e17A9698Ca70160C`](https://explorer.testnet.chain.robinhood.com/address/0xB5c97153Dca052636eD692A9e17A9698Ca70160C) | [`0x5e5cf5cf6ead416269ee1133ff07bb1c1fcff137c6ac0b645f924e417fbc4f6b`](https://explorer.testnet.chain.robinhood.com/tx/0x5e5cf5cf6ead416269ee1133ff07bb1c1fcff137c6ac0b645f924e417fbc4f6b) |
| LendingPoolV2 | [`0x3FA7bdC06E4f3134E271ff9046561A6667b1718e`](https://explorer.testnet.chain.robinhood.com/address/0x3FA7bdC06E4f3134E271ff9046561A6667b1718e) | [`0xb351c559567d5bc6d6fc1052b21cf86f90b00c4b64882b00e42fe0a0c8fa59d0`](https://explorer.testnet.chain.robinhood.com/tx/0xb351c559567d5bc6d6fc1052b21cf86f90b00c4b64882b00e42fe0a0c8fa59d0) |
| RobinhoodGovernancePhase1 | [`0x011EDe60AB460AF00E082e2086D0745B6a1B23D0`](https://explorer.testnet.chain.robinhood.com/address/0x011EDe60AB460AF00E082e2086D0745B6a1B23D0) | [`0xa8140e8ef1529e417de5ffdecf710f28807da7042e13dc884b88eb42ddb3a75b`](https://explorer.testnet.chain.robinhood.com/tx/0xa8140e8ef1529e417de5ffdecf710f28807da7042e13dc884b88eb42ddb3a75b) |

The five successful initialization transactions were issuer-role grant `0xa4040cdb52d41e18092f91e9086de2a0a49df7cfc1a8316400250b6437a581b7`, lending-token oracle bounds `0x62209599ed600443479a18d645041fad0443bd63eea7806971de714928ad6a8f`, collateral-token oracle bounds `0x3d33fc47eb77026889131c4c890251f72d706ee493a43fd6d5c2eb3331b9813f`, lending reserve config `0x7cc245e8220e1b9180af9a769a9479e2622ebd7fff600a8690a6bbd5a1f2c885`, and collateral reserve config `0xf2a49bb8df0e18f4b7f699bea2c5bb81c6c814d790be1de070d8335b0fc1ae08`. All have successful receipts on chain 46630.

The real `.env` now contains the matching `RH_TESTNET_*_ADDRESS` and `NEXT_PUBLIC_ROBINHOOD_*_CONTRACT` values. The read-only report is `bun run robinhood:deploy:show`; it verifies the artifact/RPC state and does not sign or broadcast. Blockscout currently reports source as **unverified** for all ten addresses. Deployment code is live; source publication remains a separate task.

## Deployment procedure and source verification

The deployment below is the reproducible preparation procedure retained for provenance. It has already been executed by the owner and must not be run again for this deployment. Do not copy any GIWA address into an `RH_TESTNET_*` field.

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
6. Completed for the current deployment: addresses and successful receipts were read from the 46630 broadcast artifact and independently checked against RPC; only those receipt-derived values were populated in `.env`.
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

The simulation commands do not deploy contracts, broadcast transactions, or perform explorer verification. Source verification for the current deployment is still pending.

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
- `bun run robinhood:deploy:show` passed read-only validation: chain ID `46630`, all 15 deployment/initialization receipts successful, bytecode at all 10 contract addresses, linked HonkVerifier creation bytecode, dependencies, roles, token metadata, two reserve configs, and oracle bounds. The command reports the live head when run; block height is time-sensitive.
- The official docs describe standard EVM compatibility but do not state a specific Prague fork activation for testnet. The successful Foundry compile validates the selected compiler target locally; it does not prove the remote node accepts every Prague-specific opcode. Confirm a testnet `eth_estimateGas` call with the actual deployment initcode before broadcast.
- `FOUNDRY_PROFILE=robinhood_testnet bun run contracts:build` passed with Solidity `0.8.28` and the pinned Prague target. The full Foundry suite now has `90` passing tests, including five Robinhood governance cases; legacy GIWA governance tests remain passing.
- Latest regression run: `bun run typecheck` and `bun run build` passed; `bun run contracts:test` passed `90/90`; targeted Robinhood runtime/config tests passed `12/12`. The production build prerendered all eight application routes.
- `bun run zk:conformance` passed after read-only access to the Barretenberg CRS endpoint was permitted. It accepted the valid proof and rejected under-threshold, mismatched-commitment, and wrong-wallet witnesses.
- `bun run robinhood:protocol:anvil` passed on an ephemeral local chain ID `46630`: policy-4 DAO credential, proposal, two votes, finalization and execution; proposal feed empty/populated reads, quorum/totals, and active/revoked/expired credential readback; genuine policy-3 ZK proof; Lending V2 supply, collateral, borrow, repay, withdraw and liquidation; plus invalid proof/domain rejection. This is local evidence only.
- Deployment is confirmed. No oracle prices have been set, both token supplies remain zero, and no credential, DAO proposal/vote, or Lending user-journey bootstrap transactions have yet been performed by this verification task.
- Official Dojang verified-balance attestations/witnesses are not available through this Robinhood flow. The test journey below proves only project-issued demo eligibility.
- DAO and Lending hooks resolve the configured Robinhood addresses. Borrowing remains blocked until bounded fresh prices are set and demo balances/credentials/witnesses are bootstrapped. Source verification must be submitted separately to Blockscout using the exact compiler settings and constructor/library arguments.

## Local validation commands

```sh
bun run contracts:test
bun run zk:conformance
bun run robinhood:protocol:anvil
bun run typecheck
bun run build
```

The Robinhood Anvil journey is local simulation only. It exercises policy-4 DAO proposal/vote/finalize/execute and the genuine policy-3 ZK proof plus supply, collateral, borrow, repay, withdrawal, interest, stale-price, invalid-proof, and liquidation paths on an ephemeral chain ID `46630`. The separate confirmed deployment registry above records real Robinhood contract creations; the local journey itself creates no public-chain records.
