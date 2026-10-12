# BOJOGAY Robinhood Chain Master Handoff

**Review date:** 2026-10-12  
**Target:** Robinhood Chain Testnet, chain ID `46630`  
**Mainnet:** Robinhood Chain Mainnet (`4663`) remains disabled.  
**Scope:** Predeployment architecture handoff with deployment status updated 2026-10-12. The full protocol stack is now deployed on Robinhood Testnet; see [`ROBINHOOD_TESTNET_DEMO.md`](ROBINHOOD_TESTNET_DEMO.md) for the receipt-backed registry and initialization transaction hashes.

## 1. Executive status

BOJOGAY is an independent protocol. Dojang and Bojagi are BOJOGAY module names and concepts; official GIWA Dojang/EAS remain external infrastructure used only by the existing GIWA verification and DAO path. A BOJOGAY-issued credential is not an official GIWA, Upbit, or third-party credential.

| Area | Current evidence-based state |
|---|---|
| Public Robinhood deployments | **10 contract creations + 5 initialization transactions confirmed** from `contracts/broadcast/DeployRobinhoodProtocolStack.s.sol/46630/run-latest.json`; all 15 receipts are successful and the 10 addresses have bytecode. |
| Robinhood V2 contracts | Source, chain guard, separate registry, deployment script, and local tests exist. The guarded V2 script requires an already-deployed Robinhood Honk verifier. |
| Robinhood-native DAO Phase 1 | `RobinhoodGovernancePhase1` is deployed at the receipt-derived address in the registry. Its live frontend path uses project registry policy 4; no proposal/vote bootstrap activity is claimed. |
| Robinhood wallet journey | **Runtime integration implemented.** RainbowKit/wagmi registers Robinhood Testnet first and GIWA separately. Header and V2 use chain 46630; GIWA-only Dojang/DAO/Vault/V1 features explicitly select 91342. |
| Local V2 proof and financial journey | Local Anvil run passed with a genuine proof and supply, collateral, borrow, repay, withdraw, and liquidation paths. This is not public-chain evidence. |
| Public testnet funding | The owner reports the deployer and issuer were funded before broadcast. Recheck current signer balances before bootstrap transactions; prior balances and deployment gas estimates are time-sensitive. |
| Official Dojang on Robinhood | Not a native dependency and not available as Robinhood authorization. `GovernedDojangAccess` remains GIWA-only; Robinhood DAO membership is a separate project-issued policy-4 credential. |
| Robinhood chain evidence page | `/contracts` includes all 10 configured project contracts and live bytecode plus Blockscout source status. RPC verifies the deployed code; Blockscout currently reports source unverified for all 10. |
| Browser / public network verification | All 15 deployment/initialization receipts, runtime code, dependencies, roles, token metadata, reserve settings and oracle bounds were verified read-only against chain 46630. No browser-wallet bootstrap journey has yet been verified. |

**Conclusion:** The deployed Robinhood stack is configured for the DAO and Lending V2 hooks and has been read back from chain 46630. It is deployment-ready for separately authorized bootstrap actions, but it is not yet an end-to-end public user journey: oracle prices, demo token balances, credentials/witnesses, and DAO proposals/votes are not initialized. Official Dojang remains a separate GIWA-only integration.

## 2. Routes and real behavior

There are eight application routes in `src/app/`: `/`, `/dojang`, `/dao`, `/bojagi`, `/lending`, `/contracts`, `/docs`, and `/vault`. No additional route handler is present in that directory.

| Route | Purpose and wired actions | Hooks, contracts, and network | Data and transaction boundary | Robinhood status |
|---|---|---|---|---|
| `/` | Landing and navigation into the two product stories. Links route to feature pages; this is not a protocol transaction surface. | `LandingPage`, section/reveal components. Copy and network facts currently refer to GIWA. | Presentation and static implementation/status copy; no live protocol read is established by the route itself. | Product page is visible, but its network/story copy still describes GIWA. |
| `/dojang` | Connect wallet, read/refresh official Verified Address status, import credential witness, and use separate project demo-credential tools when configured. | `useWalletNetwork`, `useDojangVerification`, demo credential/witness components. Official reads use DojangScroll, DojangAttesterBook, and EAS constants on GIWA Sepolia; project credential actions use the configured GIWA registry. | Official credential status is a live read when RPC/configuration works. Issuance/revocation require the project issuer authorization and wallet transactions. Demo credentials are explicitly separate from official records. | No official Dojang verification on Robinhood. Existing hooks, wallet, and project contract lookup are GIWA-bound. |
| `/dao` | Existing page selects GIWA or Robinhood, then discovers real proposals, details/tallies, and actions through that chain's DAO. | GIWA retains `useDaoGovernance` and official Dojang; Robinhood uses `useRobinhoodDaoGovernance`, the Robinhood Phase 1 ABI, and project policy 4. | Chain-scoped reads and query invalidation; missing code/registry mismatch disables Robinhood operations. Confirmed deployment addresses are configured. | Deployment verified; DAO proposal/credential bootstrap has not yet been run. |
| `/bojagi` | Import an issuer-backed private witness, check it against the wallet/credential commitment, generate an eligibility proof in the browser, and locally verify it. Links to Dojang, lending, and legacy Vault. | `ProofGenerationPanel`, `useEligibilityProof`, `useDemoCredential`, witness context, browser Noir/Barretenberg prover. Existing V1 flow uses policy 1 and a configured GIWA registry/Vault context. | Proof generation is local; it is not a chain transaction. The proof exposes wallet, commitment, policy/version/threshold, credential version/expiry, chain, target contract, and proof, while the private value/salt stay in the browser. | No RH-integrated page action. Separate RH V2 proof-context helpers exist in source but this page and its hooks use GIWA. |
| `/lending` | Switch between Robinhood Lending V2 and the separately mounted legacy GIWA V1 demo. V2 exposes market, supply, borrow/collateral, and position flows. | V2 hooks use chain 46630, the isolated RH address registry, RH explorer, policy-3 registry, and RH proof context. V1 continues to use GIWA. | Confirmed pool and dependency addresses are configured and resolve to deployed contracts. Prices and user credentials/token balances remain uninitialized, so risk-increasing actions are not ready. |
| `/contracts` | Lists all ten Robinhood project contracts, including DAO, and offers bytecode, receipt and event lookups against chain 46630. | `robinhoodContracts` and `RobinhoodEvidenceLookup` use only the RH RPC/client and RH address set. | Displays live RPC code state and Blockscout source-verification state; bounded logs scan 2,000-block chunks. Current result is code present/source unverified. |
| `/docs` | Static explanation of trust boundaries, implementation constraints, protocol status, and links to protocol pages. | Uses `projectContracts` counts and `WalletNetworkCard`; several status statements are GIWA-specific. | Mostly static text; wallet display is live, but the page does not implement protocol transactions. Some text is now outdated for the RH product direction and needs a content handoff. | Page is available, but its network, deployment, and V2 statements remain GIWA-centric. |
| `/vault` | Read access/threshold and submit a proof-gated `enterVault` action if configured. | `useVaultAccess`, `useDemoCredential`, witness context, GIWA wallet/client; `RestrictedVault`, registry, verifier adapter. | The Vault is an access flag and holds no funds. A transaction is simulated, signed, receipt-confirmed, and checked with an access-state readback. | No RH address, provider, or flow. Keep as a secondary/legacy technical feature. |

“A button exists” is not treated as evidence of a completed public-chain action. No route currently proves a Robinhood transaction occurred.

## 3. Corrected product journeys

### A. Dojang and DAO Governance

| Step | Current status | Evidence / dependency |
|---|---|---|
| Connect wallet | The DAO page offers distinct GIWA and Robinhood paths and matches the wallet's supported chain. | GIWA authorization uses official Dojang on 91342; Robinhood authorization uses project policy 4 on 46630. |
| Obtain official Dojang credential | External user process; not issued by BOJOGAY. | Official Dojang/EAS integration is GIWA-only. The app only reads a record. |
| Read/validate official credential | Integrated and locally tested for the GIWA path; availability depends on official contract/RPC reads. | `useDojangVerification` checks wallet, trusted attester from DojangAttesterBook, schema, EAS validity, expiry, revocation, and verified content. |
| Become eligible for DAO | GIWA: valid official Dojang membership. Robinhood: a current project-issued policy-4 credential. | Each contract checks its own chain-specific credential source. A project credential does not pass GIWA checks; official Dojang is not a Robinhood dependency. |
| Create and vote | Implemented in hooks/contracts; local test coverage exists; requires public GIWA deployment and eligible wallets for a live transaction. | `createProposal`, `castVote`, receipt/state checks. |
| Finalize and execute | Implemented under contract lifecycle rules and callable without member status. | `finalizeProposal`, `executeProposal`; execute only applies the bounded policy owned by the DAO. |
| Run DAO Phase 1 on Robinhood | Contract is deployed and configured; public proposal/credential demo bootstrap remains pending. | `RobinhoodGovernancePhase1` is pinned to 46630 and checks project-issued registry policy 4, expiry, revocation, and current `ISSUER_ROLE`. It does not consume official Dojang or Lending policy 3. |

The Robinhood DAO is a **new BOJOGAY-native governance deployment/version**, not a fake official Dojang result or a renamed official credential. Its policy-4 record is checked on chain for subject, commitment, version, issue/expiry, revocation, and current issuer authorization. The existing Robinhood Lending credential is policy 3 and does not grant governance membership. The GIWA contract and frontend behavior remain unchanged.

### B. Bojagi-inspired eligibility and Lending V2

The correct contract order is **credential/proof before proof-gated supply; collateral deposit before enabling collateral; then borrow**. Repayment and safe exits should remain possible without fresh authorization.

| Step | Current status | Robinhood requirement |
|---|---|---|
| Connect wallet | Robinhood Testnet is the primary app network; GIWA remains available for its existing journeys. | V2 selects chain 46630; the legacy V1 flow remains on 91342. Chain 4663 is not enabled. |
| Deploy verifier dependencies and V2 stack | Completed on chain 46630; all ten creations and five initialization receipts succeeded. | Read-only recheck: `bun run robinhood:deploy:show`. Do not rerun deployment scripts for the existing stack. |
| Issue a BOJOGAY test credential | Registry and issuer role are deployed and verified; no policy-3 borrower/supplier credential has been issued in this bootstrap. | Issuer submits policy-3 commitment for each participant and provides the matching witness privately. |
| Prepare private witness | Witness import format and browser memory provider exist; issuer-side safe delivery is operationally separate. | Witness must match wallet, commitment, policy 3, version/expiry and current on-chain registry record. Never publish the private value or salt. |
| Generate genuine proof | The integrated RH V2 hook uses the existing browser prover and RH-only context validator; local Anvil verification passed in this run. | Proof binds subject wallet, commitment, policy 3/version 1/threshold 1000, credential version/expiry, chain 46630, and exact configured LendingPoolV2 address. On-chain verifier remains authoritative. |
| Supplier supplies liquidity | Solidity path is proof-gated; owner reports local journey success. | Supplier also needs its own active policy-3 credential and proof; liquidity token must be minted/transferred to supplier and approved. |
| Borrower deposits collateral | Implemented; not itself proof-gated in V2. | Collateral token balance, approval, active reserve, and cap are required. |
| Enable collateral | Proof-gated by the V2 contract. | Borrower submits current valid RH-bound proof and selects the supported collateral reserve. |
| Borrow | Proof-gated; checks credential, proof domain, liquidity, caps, oracle freshness, LTV, and health. | Fresh bounded synthetic test prices must be set first; sufficient supplier liquidity and collateral are required. |
| Monitor interest and health | Source and UI reads support it; local test path reported. | Read V2 reserves, rates, oracle update time, balances, and account health from the RH deployment; this is not market data. |
| Repay | Implemented without proof reauthorization. | Borrower needs lending token plus gas. |
| Withdraw supplied liquidity | Implemented with available-liquidity constraints; no proof reauthorization. | Pool must have enough available liquidity. |
| Withdraw collateral | Implemented without proof reauthorization but health checks reject unsafe exits. | Must preserve a safe account health factor while debt remains. |
| Liquidate | Implemented in V2; owner reports local success. | Requires an unhealthy position, a fresh test oracle value, liquidator debt tokens, configured close factor/bonus and available collateral. |

This is a **functional testnet demo**, not a public lending market. Assets are controlled project test tokens, prices are operator-set synthetic values, and issuer/oracle authority is centralized. It is not official Dojang verification, native GIWA Bojagi, real-value lending, or a market oracle.

## 4. Network and proof architecture

### Current repository split

| Concern | Existing behavior | Robinhood gap |
|---|---|---|
| Wallet/provider | `supportedProtocolChains` registers Robinhood first, then GIWA; provider transports use their separate public RPC values. | 4663 is absent. `primaryProtocolChainId` is 46630. |
| Wallet guard | `useWalletNetwork(expectedChainId = 46630)` exposes both network booleans and explicit switch functions. | GIWA legacy components/hooks pass 91342 explicitly; RH V2 and header select 46630. |
| Address registry | `getLendingV2ContractSet(chainId)` returns an isolated address set and never falls back between chains. | RH set includes pool, registry, verifier adapter, oracle, verifier dependencies and configured test asset addresses; address settings alone do not activate writes. |
| RPC | `appEnv.robinhoodRpcUrl` centralizes the RH RPC; GIWA keeps its own RPC. | Read-only deployment validation returned chain `0xb626` (46630), head `133710206`, and verified the full deployment registry. Head height is time-sensitive. |
| Proof domain | RH V2 hooks use RH-only context creation/validation. | All nine public inputs bind wallet, commitment, policy, version, threshold, credential version/expiry, chain 46630, and exact RH pool. `robinhood-demo-credential-v1` witnesses cannot enter the GIWA V1 witness path. |
| Query keys | GIWA V2 helpers retain 91342. RH market, deployment and credential keys include 46630. | Mutation invalidation uses RH keys and never invalidates GIWA queries. |
| Contract chain guard | `LendingPoolV2` accepts only 91342 or 46630 and checks supplied proof chain against `block.chainid`. RH registry constructor is pinned to 46630. | RH deployment reads check chain, pool code, policy constants, configured registry, adapter, underlying HonkVerifier and oracle addresses/bytecode. |
| Simulation/receipt | RH V2 actions use chain 46630 simulation, gas/fee headroom, wallet write, receipt, event/readback and RH explorer links. | Confirmed contract addresses now resolve; the journey still needs prices, minted demo assets, credentials and private witnesses. |
| Oracle freshness | `LendingPoolV2` checks missing, out-of-bounds, stale, and future oracle values against reserve configuration. | Deployment initializes bounds but intentionally seeds no price. Operator must separately set synthetic prices; keep freshness failures visible. |
| Mainnet | No RH mainnet connector or deployment profile is part of the current plan. | Do not add chain 4663 to supported write chains absent explicit owner approval and production controls. |

GIWA-specific surfaces remain `useDojangVerification`, official DAO hooks/contracts, Vault and V1 Lending hooks, and the GIWA evidence adapter. They continue to target 91342. RH V2 hooks and evidence are separate and use the chain registry described above.

The RH proof helper is useful but is not an integration by itself: current credential issuance, credential reads, wallet guard, hook query keys, and writes must all agree on the RH registry, chain, and pool address. A proof prepared for a different chain, wallet, policy, credential, or pool must be rejected.

## 5. Project contract and asset inventory

Across current Solidity source there are **11 concrete named contract types and 9 named library definitions** (not counting interfaces or test mocks). The confirmed RH deployment contains **10 on-chain instances**: two linked libraries, one Honk verifier, one Robinhood credential registry, one adapter, one test oracle, two controlled test tokens, one LendingPoolV2, and one RobinhoodGovernancePhase1. The exact receipt-derived address/transaction registry is in [`ROBINHOOD_TESTNET_DEMO.md`](ROBINHOOD_TESTNET_DEMO.md).

| Entry | Ownership/type | Network and current deployment | Address/configuration | Dependencies / ABI / use |
|---|---|---|---|---|
| `ZKTranscriptLib` | Project-generated Solidity library | Deployed on RH 46630; address and successful receipt are in the deployment registry. | `RH_TESTNET_ZK_TRANSCRIPT_LIB_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_ZK_TRANSCRIPT_LIB_CONTRACT`. | Deployed before HonkVerifier and confirmed in linked creation bytecode. Not a direct UI call. |
| `RelationsLib` | Project-generated Solidity library | Deployed on RH 46630; address and successful receipt are in the deployment registry. | `RH_TESTNET_RELATIONS_LIB_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_RELATIONS_LIB_CONTRACT`. | Linked to HonkVerifier. Not a direct UI call. |
| `HonkVerifier` | Project-generated proof verifier contract | Deployed on RH 46630; creation bytecode matched to the compiler artifact and linked libraries. | `RH_TESTNET_HONK_VERIFIER_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_HONK_VERIFIER_CONTRACT`. | Constructor has no Solidity args; `EligibilityVerifierAdapter` points to this verifier. |
| `RobinhoodDemoCredentialRegistry` | Project-owned RH-specific registry | Deployed on RH 46630; admin and separate issuer role verified. | `RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT`. | RH issuance and credential-read hooks use this isolated configured address. |
| `EligibilityVerifierAdapter` | Project-owned contract | Deployed on RH 46630; verifier dependency readback confirmed. | `RH_TESTNET_VERIFIER_ADAPTER_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_VERIFIER_ADAPTER_CONTRACT`. | Points to RH HonkVerifier; V2 pool depends on adapter. |
| `ControlledTestOracle` | Project-owned test oracle | Deployed on RH 46630; token bounds verified and prices remain unset. | `RH_TESTNET_LENDING_V2_ORACLE_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ORACLE_CONTRACT`. | Admin controls synthetic prices. This is not an external market oracle. |
| `ControlledTestToken` — rUSD2 | Project-owned ERC-20 test asset / lending reserve | Deployed on RH 46630; 6 decimals, supply remains zero. | `RH_TESTNET_LENDING_V2_ASSET_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ASSET_CONTRACT`. | Capped demo supply; used for supplied liquidity and debt. ABI is `controlledTokenAbi`. |
| `ControlledTestToken` — rCOL2 | Project-owned ERC-20 test asset / collateral reserve | Deployed on RH 46630; 18 decimals, supply remains zero. | `RH_TESTNET_LENDING_V2_COLLATERAL_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_COLLATERAL_CONTRACT`. | Capped demo supply; used for collateral. ABI is `controlledTokenAbi`. |
| `LendingPoolV2` | Project-owned multi-reserve lending market | Deployed on RH 46630; both reserve settings verified against the approved configuration. | `RH_TESTNET_LENDING_V2_POOL_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT`. | Depends on RH credential registry, verifier adapter, oracle and admin. `lendingPoolV2Abi` powers the V2 UI. `MAX_RESERVES = 8`. |
| `RobinhoodGovernancePhase1` | Project-owned RH-native DAO Phase 1 | Deployed on RH 46630 and included in the Robinhood DAO address registry. | `RH_TESTNET_GOVERNANCE_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT`. | Uses policy 4 in the Robinhood project registry. Only governance action changes the DAO's own `minimumRemainingValidity`; no Lending risk control. |
| `GovernedDojangAccess` | Project-owned DAO Phase 1 | Hard-bound to GIWA chain 91342; no RH deployment. | Existing GIWA deployment/config fields only; none are RH outputs. | Requires external GIWA DojangScroll, DojangAttesterBook, EAS, official attester/schema IDs, and governance parameters. `daoGovernanceAbi`; current frontend uses it only on GIWA. |
| `DemoCredentialRegistry` | Project-owned legacy/demo registry | Used by GIWA/V1 and historical flows; no RH address should be reused. | GIWA `GIWA_CREDENTIAL_REGISTRY_ADDRESS` / `NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT`; RH has its separate registry variable above. | Issuer-managed commitment records. Do not pass a GIWA address into RH. |
| `LendingPool` (V1) | Project-owned legacy lending | Historical GIWA deployment script only; not in the RH V2 deployment script. | GIWA `GIWA_LENDING_POOL_ADDRESS` / `NEXT_PUBLIC_LENDING_POOL_CONTRACT`; no RH output. | Legacy registry, adapter, fixed demo assets. Policy 2 path; fixed 1:1 price, no V2 interest/oracle/liquidation behavior. |
| `RestrictedVault` | Project-owned access gate; no fund custody | Existing technical route and GIWA deployment path; not in RH V2 stack. | GIWA `GIWA_RESTRICTED_VAULT_ADDRESS` / `NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT`; no RH output. | Registry + verifier adapter; `enterVault` proof check. Does not custody tokens. |
| `UtilizationRateModel` | Project library, internal pure rate calculation | Used by LendingPoolV2 source; not a separate external deployment dependency in the RH script. | No address variable. | Its internal math is compiled into the pool. |
| `GIWASepoliaDojang` config and interfaces | Project source config/interfaces, not deployed protocol instances | Historical network binding. | Constants and interface ABI only. | Reference external DojangScroll, attester book, EAS. |

### External infrastructure and assets

- **Robinhood Chain Testnet** is the target execution network, not a BOJOGAY contract.
- **Robinhood Testnet Explorer / Blockscout** is an external evidence source. A link is not an on-chain read or deployment proof.
- **GIWA Sepolia, official DojangScroll, DojangAttesterBook, and EAS** are external infrastructure for the old official credential/DAO path. They are not BOJOGAY-owned and are not Robinhood dependencies.
- **Bojagi** is a conceptual privacy reference. BOJOGAY implements eligibility proofs, not GIWA's private-transfer protocol.
- **Supported RH test tokens** in the deployment script are rUSD2 and rCOL2 only. They are not bridge assets or market-backed tokens.

### Reserves and scalable registry design

`LendingPoolV2` supports at most eight reserve asset addresses. A risk admin can configure another reserve without redeploying the pool while capacity remains, provided the asset meets the contract's controlled-demo-token interface/marker, code, and decimals checks. Each reserve requires explicit supply/borrow/collateral caps, enabled flags, minimum borrow, oracle freshness, LTV, liquidation threshold/bonus/close factor, reserve factor, optimal utilization, base rate and slopes; the oracle needs matching bounds and a fresh price. The V2 contract's risk admin, not DAO Phase 1, controls those settings. Adding a reserve does not make an arbitrary token or market safe.

The typed runtime registry now separates the supported GIWA and Robinhood contract sets by `chainId`, including verifier dependencies, registry, pool, oracle, configured token outputs, and explorer. It never falls back across chains. Current RH addresses, receipts, dependencies and reserve configuration are documented in [`ROBINHOOD_TESTNET_DEMO.md`](ROBINHOOD_TESTNET_DEMO.md) and rechecked by `bun run robinhood:deploy:show`; do not treat environment configuration alone as deployment evidence.

## 6. `/contracts` page and chain evidence

### Page correction

The active `/contracts` experience is Robinhood Testnet (46630), contains no official GIWA contract promotion, and displays all 10 deployed project contracts alongside legacy non-RH contracts with explicit boundaries. It consumes only `NEXT_PUBLIC_ROBINHOOD_*_CONTRACT` address config, checks live Robinhood bytecode, and displays Blockscout source status separately. Current public addresses have code; Blockscout reports source unverified for all 10.

Status semantics are deliberately separated:

1. **Not configured** — no valid address was supplied.
2. **Not deployed / no code** — can only be asserted after a chain-46630 RPC bytecode read at a configured address.
3. **Code present** — requires a successful nonempty-bytecode read; it does not establish source verification.
4. **Receipt confirmed** — requires reading the deployment transaction receipt and checking status, address, block, and chain.
5. **Source verified** — requires a Blockscout verification-state read for the exact deployed address/compiler/settings.

The page checks configured-address bytecode on chain 46630, reads arbitrary transaction receipts, scans bounded project-address event ranges, and queries Blockscout source-verification status. Address configuration remains separate from code presence; receipt lookups confirm only the queried transaction, not that an address is a deployment receipt.

### Existing evidence service behavior

`src/lib/protocol/chain-evidence.ts` is an authentic but GIWA-only read adapter:

- It calls `getChainId()` and rejects any chain other than `91342`.
- `inspectProjectDeployment` checks configured GIWA registry, verifier adapter, Vault, V1 LendingPool, and DAO addresses for runtime bytecode/code hash, then reads selected constructor links. It can discover the generated HonkVerifier and V1 lending/collateral tokens. It does not provide a complete V2/RH inventory.
- `readProjectTransactionEvidence` accepts an arbitrary transaction hash **on GIWA**, reads its receipt/status/gas fields, and attaches only receipt logs whose emitter matches a configured/discovered project contract. It can therefore show a non-project transaction receipt with no project events.
- `readProjectProtocolLogs` scans configured/discovered project addresses over an explicit range, caps the total range at 100,000 blocks, requests chunks up to 10,000 blocks (default 1,000), clamps the end to the latest block, and does not query chain-wide statistics. Scanning can only find events after deployment and within the chosen range.
- Explorer transaction/address URLs use GIWA Sepolia. No Anvil hash is a public GIWA or Robinhood receipt.
- It does not verify Blockscout source status or deployment receipt provenance for an address. A code hash alone is not verification.

The prior `/contracts` implementation invoked the GIWA-only service. The page now uses `src/lib/protocol/robinhood-chain-evidence.ts`: it rejects non-46630 clients, checks bytecode only for configured RH addresses, reads actual receipt and transaction fields, decodes configured registry/oracle/token/V2 pool events, scans at most 100,000 latest-confirmed blocks in 2,000-block chunks, queries Blockscout source-verification status, and propagates RPC/rate-limit failures. The dedicated deployment display command validates receipt provenance from the broadcast artifact. Source status is unverified; code presence is not represented as source verification.

## 7. Remaining launch blockers

### Remaining before the public demo journey

1. Confirm current test ETH balances for admin, issuer, governance participants, supplier, borrower, and liquidator. Earlier funding observations are time-sensitive.
2. Set bounded synthetic prices using the approved operator wallet; currently both prices are zero/unset. Verify the readback remains within the deployed oracle bounds.
3. Mint capped project demo tokens to the designated supplier and borrower, with repayment liquidity; token supplies are currently zero.
4. Issue policy-4 project credentials for the Robinhood DAO demonstration and policy-3 credentials for Lending participants; securely deliver matching private witnesses. Do not describe these as official Dojang credentials.
5. Run DAO proposal/vote and Lending proof, supply, collateral, borrow, repay, and safe withdrawal journeys; capture live receipts and state readbacks. Keep liquidation a controlled scenario with a deliberately unhealthy position and synthetic price.
6. Submit source verification for all deployed contracts to Blockscout with exact compiler settings, constructor arguments, and library links. Current Blockscout status is unverified for all ten.
7. Re-run `bun run robinhood:deploy:show` before the session to confirm chain 46630 and deployment code/dependencies. This command is read-only.

### Must fix before any public financial use

- Replace the controlled test oracle and controlled demo tokens with a reviewed production asset/oracle design; remove operator-set synthetic prices from the public financial path.
- Independent security review/audit of the full ZK, token, oracle, lending, interest, liquidation, pause, role, and upgrade/deployment configuration; no audit result is currently claimed.
- Owner-approved and risk-reviewed caps, rate model, collateral factors, oracle freshness/failure behavior, liquidation incentive/close factor, reserve factors, admin/pauser separation, and emergency response.
- Production-grade oracle sources, liveness/heartbeat, decimal normalization, manipulation resistance, asset listing/issuer controls, monitoring, incident controls and operational key custody.
- Formal acceptance of interest accrual/accounting, rounding/dust, share/debt behavior, solvency and liquidation behavior under adversarial boundaries and multiple reserves.
- Complete the separate Robinhood DAO demo bootstrap and verify the policy-4 frontend journey; do not reuse official GIWA checks or policy-3 Lending credentials by implication.
- Mainnet remains separately gated at chain 4663 and is not an extension of this testnet demo.

### Optional after the demo

- A configurable multi-market UI/registry beyond the two scripted test assets.
- Consider surfacing the existing RH receipt/event evidence adapter in the public documentation view.
- Decide whether to port the legacy Vault or V1 LendingPool. Neither is required for the V2 RH Lending demo.
- Revisit official Dojang support only if a legitimate third-party service supports it on the target network; otherwise keep that integration as GIWA-only history.

## 8. User-facing GIWA references for the product/visual handoff

These are historical presentation recommendations, not protocol blockers. The RH hooks, provider, and deployment are now integrated. Keep the approved landing visuals, 3D glyphs, scroll behavior, Lenis, layout, typography, and animation untouched unless Claude separately owns those changes.

| Website source | Current GIWA-facing content | Recommendation |
|---|---|---|
| `src/components/site-header.tsx` | GIWA network badge and expected chain 91342. | After RH provider is integrated, show selected supported network and chain ID from wallet state. Do not label a connected RH wallet as GIWA. |
| `src/components/site-footer.tsx` | GIWA setup, Dojang contracts, GIWA explorer, testnet legal copy. | Replace primary network references with BOJOGAY / Robinhood Testnet; retain official GIWA/DoJang docs only as clearly external/historical references if still useful. |
| `src/components/landing/sections.tsx` | GIWA public-state labels, “what GIWA trusts”, GIWA launch status, network facts and GIWA deployment milestones. | Reframe as BOJOGAY-owned credential/proof flows and RH Testnet status. Never imply official GIWA integration is RH runtime authorization. |
| `src/components/landing/cover-reveal.tsx`, `final-reveal.tsx` | GIWA Sepolia title/close copy and GIWA footer links. | Update brand/network copy to BOJOGAY and RH when product integration is ready; preserve the approved animation/3D markup. |
| `src/components/prototype-bar.tsx` | GIWA testnet and “not deployed” status banner. | Historical frontend handoff: show RH deployment status only from verified receipt/RPC evidence. |
| `src/app/dojang/page.tsx` | Correctly describes official Dojang as GIWA-only. | Keep the distinction, but present official Dojang as external GIWA-only functionality and label the Robinhood credential path BOJOGAY-issued. Do not make the project credential look official. |
| `src/app/dao/page.tsx`, `src/components/dao/dao-panels.tsx`, `dao-workspace.tsx`, `proposal-detail.tsx`, `proposal-feed.tsx` | DAO page now offers separate GIWA/official-Dojang and Robinhood/project-policy-4 paths with chain-aware feed and transaction copy. | Preserve the credential boundary. The Robinhood DAO action only changes its own access-policy validity; it does not control Lending V2 risk settings. |
| `src/components/demo-credential-tools.tsx`, `src/components/lending/lending-issuer-tools.tsx` | Issuance/revocation callouts and network conditions name GIWA. | Keep legacy issuer tools GIWA-only; add separate RH issuance controls only when the RH registry hook is integrated. |
| `src/app/bojagi/page.tsx` | Correct disclaimer that it is not GIWA's native private transfer. | Keep the capability boundary, but describe it as BOJOGAY's Bojagi-inspired eligibility proof rather than an implementation of GIWA's transfer system. |
| `src/app/lending/page.tsx`, `src/components/lending-v2/lending-v2-workspace.tsx`, `v2-borrow.tsx`, `v2-eligibility.tsx`, `v2-liquidation.tsx`, `v2-markets.tsx`, `v2-position.tsx`, `v2-status.tsx`, `v2-supply.tsx` | V2 network, not-deployed message, explorer and wallet statuses say GIWA. | After integration, label RH chain, controlled tokens, synthetic oracle and BOJOGAY test credential accurately; keep all demo limitations visible. |
| `src/components/lending/lending-workspace.tsx`, `borrow-view.tsx`, `lending-panels.tsx`, `lending-asset-rows.tsx` | Legacy V1 wallet, explorer and transaction copy says GIWA. | Keep it marked as the legacy GIWA path or hide it from RH flows; do not present V1 addresses as RH V2. |
| `src/components/proof-generation-panel.tsx`, `src/components/vault-action-panel.tsx` | Proof and Vault network prompts say GIWA. | Preserve them as GIWA legacy behavior; do not imply the RH V2 proof path is active on these routes. |
| `src/app/docs/page.tsx` | GIWA deployment pending, live GIWA Dojang, GIWA test results, current route trust model. | Update product/network status and DAO/V2 separation from verified contract integration; retain GIWA as external/historical dependency only. |
| `src/app/contracts/page.tsx` | Shows all ten Robinhood deployment addresses and live chain-46630 bytecode and Blockscout source status. | Preserve separate states for code present and source unverified. |
| `src/components/wallet-network-card.tsx` | GIWA expected-chain labels/status. | Switch to selected supported chain after provider/hook integration; don't update copy to RH before the wallet can actually use RH. |
| `src/components/site-header.tsx`, `src/components/site-footer.tsx` | Global testnet badge and footer references say GIWA. | Show the actually selected supported chain; keep external GIWA links only under an external/historical label. |

The exhaustive source scan also finds GIWA wording in the non-active GIWA evidence components `src/components/evidence/chain-evidence-lookup.tsx`, `project-contract-rows.tsx`, and `use-project-evidence.ts`; they still serve GIWA routes/consumers and must remain GIWA-bound until a separate RH evidence adapter exists. `src/lib/config/env.ts` and `.env.example` still default the global product name to “Private Verifiable State”; the BOJOGAY brand is not yet the configured default and should be applied in the visual/product handoff. In total, the user-facing/runtime source matches occur in the route and component files listed in this section; Solidity, circuit, generated verifier, and historical Markdown matches are implementation provenance, not website copy.

Other `GIWA` strings in circuit identifiers, Solidity chain constants, generated verifier source, historical deployment scripts and historical docs are technical provenance/compatibility and must not be globally replaced. In particular, preserve the official GIWA DAO and GIWA registry path while a separate RH system is designed.

## 9. Original implementation plan and current execution state

This table preserves the original dependency order and records the current status. It is not authorization to broadcast or to enable Mainnet.

| Order | Owner | Work and likely files | Acceptance evidence |
|---|---|---|---|
| 0 | Owner + Codex | Approve demo-only financial settings and admin/issuer roles; keep keys out of repo/chat. | The deployed configuration and role readbacks match the approved test settings; recheck participant funding before bootstrap. |
| 1 | Codex | Make verifier artifact reproducible and add guarded RH verifier/library simulation paths. | Completed; HonkVerifier creation bytecode and both links matched the generated artifact and deployed library receipts. |
| 2 | Codex | Integrate isolated RH network and address registry while keeping GIWA separate and Mainnet absent. | Completed; chain 91342/46630 paths remain isolated and Robinhood Mainnet is not enabled. |
| 3 | Codex | Add RH V2 read/write/issuer/proof hooks using the existing service and ABI. | Completed and locally validated; the public addresses now resolve through the RH registry. |
| 4 | Codex | Add read-only Robinhood contract, transaction, and event evidence. | Completed; chain guard, live bytecode, receipt, bounded event, and Blockscout source states are available. |
| 5 | Owner + Codex | Deploy the approved verifier/V2/DAO stack and configure receipt-derived addresses. | Completed on chain 46630; 10 creation and 5 initialization receipts passed. Blockscout source verification remains outstanding. |
| 6 | Claude with stable hooks | Integrate visual/network copy and Contracts evidence presentation without changing protocol behavior. | Frontend integration is present; `/contracts` lists the full RH deployment and displays read-only evidence. |
| 7 | Codex + QA/owner | Run browser-wallet bootstrap and test journeys for issuer, governance, supplier, borrower, and liquidator. | Pending; set synthetic prices, mint capped demo tokens, issue project credentials, import private witnesses, then capture real chain receipts and readbacks. |
| 8 | Owner + Codex, separate future work | Decide if BOJOGAY-native DAO is needed on RH. If yes, specify governance credential policy and create/version a DAO contract with explicit RH authorization. | New authorization/security review, contract tests, deployment review, and a separate decision; never reinterpret the GIWA DAO as RH-ready. |

### Division of work

- **Codex:** protocol contract and verifier deployment preparation, proof/network configuration, chain-aware hooks/services, read-only evidence adapter, receipt-derived deployment registry, integration tests, and deployment documentation.
- **Claude:** page/landing copy and visual integration after the hook contract is stable, including BOJOGAY/Robinhood labels and truthful demo disclosures. Preserve the current typography, glyphs, motion, scroll, and Lending V2 visual work unless separately requested.
- **Owner:** approve risk parameters and operational roles; provide test ETH to public wallet addresses; authorize any eventual deployment transaction separately. No key material is requested or stored here.

## 10. Acceptance tests and proof of completion

### Deployment and bootstrap acceptance

- Latest targeted validation: `bun run typecheck` and `bun run build` passed; `bun run contracts:test` passed 90/90; Robinhood runtime adapter/config tests passed 12/12. Earlier ZK conformance and RH local V2 Anvil lifecycle also passed; ZK conformance required access to the Barretenberg CRS endpoint.
- Deployment verification passed against chain ID `0xb626` / decimal 46630: 15 successful receipts, 10 deployed bytecodes, dependencies, roles, bounds, and reserve configuration. Run the read-only deployment display again before any bootstrap session.
- Foundry RH profile uses Solidity 0.8.28 and Prague, and simulation refuses chain 91342/Mainnet or any broadcast/signing flag in dry-run mode.
- Recompute proof public inputs and verify policy, wallet, commitment, credential version/expiry, chain and pool address. Change each field independently and show a mismatch is rejected by client and on-chain verifier/pool.
- Verify admin and issuer are distinct and configured roles read back as expected; ensure no price is set until operator deliberately initializes the synthetic test scenario.

### Remaining after deployment

- Deployment transaction hashes, successful receipts, addresses, bytecode, constructor/dependency readbacks, and Blockscout source results are recorded in `ROBINHOOD_TESTNET_DEMO.md` and `bun run robinhood:deploy:show`. Blockscout currently reports source unverified; keep “code present” distinct from “source verified.”
- Confirm pool `reserveCount == 2`, exact rUSD2/rCOL2 addresses, caps/flags/risk values match the approved settings, and `MAX_RESERVES == 8` from source.
- Generate and locally verify proof for actual RH user; submit a transaction and confirm the on-chain verifier and pool accept it. Also assert rejection for a GIWA chain proof, wrong user, wrong pool, wrong policy/threshold, expired/revoked credential, and bad private witness.
- Complete actual wallet receipts and readback for supplier eligibility + supply; borrower collateral deposit + proof-gated collateral enable + borrow; interest/health reads; repay; safe collateral exit; unsafe exit rejection; and a controlled oracle-driven liquidation.
- Confirm all transaction links use Robinhood explorer and no local Anvil hash appears as a public-chain result.

## 11. Work performed for this handoff

- The active wallet default is Robinhood Testnet; GIWA remains isolated for official Dojang/DAO and legacy V1/Vault features. RH V2 issuance, proof context, market transactions, cache invalidation and explorer links use chain 46630.
- RH V2 deployment reads now validate configured registry, verifier adapter, oracle and underlying HonkVerifier addresses against the pool/adapter and confirm dependency bytecode before treating the deployment as compatible.
- `/contracts` lists the 10 deployed RH contracts, checks live bytecode, and displays Blockscout source status plus bounded V2 event scanning.
- The real `.env` contains receipt-derived Robinhood addresses for all 10 contracts in both `RH_TESTNET_*_ADDRESS` and `NEXT_PUBLIC_ROBINHOOD_*_CONTRACT` schema variables. `.env.example` remains a blank template and documents these outputs.
- Added `RobinhoodGovernancePhase1`, pinned to chain 46630, using project-issued registry policy 4. It checks current issuer role and credential expiry/revocation and only changes its own protected-access validity setting. GIWA governance, DAO hooks, Lending V2 mechanics and circuits were left intact.
- Added independent verifier and complete stack deployment simulations. The verifier linker checks compiler-generated library placeholders by name; it does not reuse GIWA or Anvil addresses. The full stack requires explicit governance and financial configuration and leaves oracle prices unset.
- `bun run contracts:test` passed 90/90; `bun run typecheck` and `bun run build` passed; `bun run zk:conformance` passed with CRS access. `bun run robinhood:protocol:anvil` passed the policy-4 DAO flow and real proof-backed Lending V2 flow on an isolated chain 46630. Both the full-stack simulation and standalone verifier simulation exited successfully without broadcast.
- Read-only Robinhood RPC verification confirmed all 15 artifact receipts, bytecode for 10 contracts, verifier linking, dependencies, admin/issuer roles, token identities/caps, oracle bounds, and both reserve configurations. The current head and balance/gas values are time-sensitive.
- The first CRS fetch and localhost-binding attempts were restricted; permitted read-only/local retries passed. These are local validation results, not public-chain evidence.
- This handoff update adds no deployment transactions, oracle writes, token mints, credential issuance, commits, or pushes. Source verification and the user-facing DAO/Lending bootstrap remain outstanding. Official Dojang remains external and unavailable as Robinhood authorization. No claim of testnet demo completion is made.

