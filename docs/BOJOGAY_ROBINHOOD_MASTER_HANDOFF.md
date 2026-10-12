# BOJOGAY Robinhood Chain Master Handoff

**Review date:** 2026-10-12  
**Target:** Robinhood Chain Testnet, chain ID `46630`  
**Mainnet:** Robinhood Chain Mainnet (`4663`) remains disabled.  
**Scope:** Current application behavior, Robinhood readiness, and the dependency-ordered next implementation plan. No contracts were deployed and no transactions were broadcast for this handoff.

## 1. Executive status

BOJOGAY is an independent protocol. Dojang and Bojagi are BOJOGAY module names and concepts; official GIWA Dojang/EAS remain external infrastructure used only by the existing GIWA verification and DAO path. A BOJOGAY-issued credential is not an official GIWA, Upbit, or third-party credential.

| Area | Current evidence-based state |
|---|---|
| Public Robinhood deployments | **0 confirmed.** No Robinhood deployment addresses or receipts are in the repository's deployment records. The owner also reports that no project contracts have been deployed publicly. |
| Robinhood V2 contracts | Source, chain guard, separate registry, deployment script, and local tests exist. The guarded V2 script requires an already-deployed Robinhood Honk verifier. |
| Robinhood-native DAO Phase 1 | Separately versioned `RobinhoodGovernancePhase1` uses project registry policy 4 and has a local tested lifecycle. The existing DAO page now supports a separate Robinhood client, ABI, credential status, proposal feed, and transaction path; it remains undeployed. |
| Robinhood wallet journey | **Runtime integration implemented.** RainbowKit/wagmi registers Robinhood Testnet first and GIWA separately. Header and V2 use chain 46630; GIWA-only Dojang/DAO/Vault/V1 features explicitly select 91342. |
| Local V2 proof and financial journey | Local Anvil run passed with a genuine proof and supply, collateral, borrow, repay, withdraw, and liquidation paths. This is not public-chain evidence. |
| Public testnet funding | Direct read-only RPC check at block `133680842` confirmed `0.01` test ETH each for the supplied deployer and issuer. The full-stack no-broadcast estimate is `0.000448957002447849` ETH at the reported max fee, before later user transactions. The Foundry account alias remains unset and must be verified. |
| Official Dojang on Robinhood | Not a native dependency and not available as Robinhood authorization. `GovernedDojangAccess` remains GIWA-only; Robinhood DAO membership is a separate project-issued policy-4 credential. |
| Robinhood chain evidence page | `/contracts` now reads configured address bytecode, authentic 46630 receipts, and bounded V2 project events. Source verification remains a manual Blockscout check; no address or deployment is configured. |
| Browser / public network verification | Direct read-only RPC calls succeeded during this handoff; no browser-wallet transaction was performed. Recheck RPC availability and the latest head before any separately authorized deployment. |

**Conclusion:** Robinhood V2 runtime integration and a separate Robinhood-native Phase 1 DAO contract are implemented and locally tested. The existing DAO page now selects between the GIWA official-Dojang path and the Robinhood project-credential path. This is not yet a public testnet journey: no RH contract address is configured, no contracts are deployed, and the Foundry signer alias must be verified before an explicitly authorized deployment.

## 2. Routes and real behavior

There are eight application routes in `src/app/`: `/`, `/dojang`, `/dao`, `/bojagi`, `/lending`, `/contracts`, `/docs`, and `/vault`. No additional route handler is present in that directory.

| Route | Purpose and wired actions | Hooks, contracts, and network | Data and transaction boundary | Robinhood status |
|---|---|---|---|---|
| `/` | Landing and navigation into the two product stories. Links route to feature pages; this is not a protocol transaction surface. | `LandingPage`, section/reveal components. Copy and network facts currently refer to GIWA. | Presentation and static implementation/status copy; no live protocol read is established by the route itself. | Product page is visible, but its network/story copy still describes GIWA. |
| `/dojang` | Connect wallet, read/refresh official Verified Address status, import credential witness, and use separate project demo-credential tools when configured. | `useWalletNetwork`, `useDojangVerification`, demo credential/witness components. Official reads use DojangScroll, DojangAttesterBook, and EAS constants on GIWA Sepolia; project credential actions use the configured GIWA registry. | Official credential status is a live read when RPC/configuration works. Issuance/revocation require the project issuer authorization and wallet transactions. Demo credentials are explicitly separate from official records. | No official Dojang verification on Robinhood. Existing hooks, wallet, and project contract lookup are GIWA-bound. |
| `/dao` | Existing page selects GIWA or Robinhood, then discovers real proposals, details/tallies, and actions through that chain's DAO. | GIWA retains `useDaoGovernance` and official Dojang; Robinhood uses `useRobinhoodDaoGovernance`, the Robinhood Phase 1 ABI, and project policy 4. | Chain-scoped reads and query invalidation; missing code/registry mismatch disables Robinhood operations. No addresses are configured, so public operations remain unavailable. | Local Robinhood read/write lifecycle and feed adapter pass on Anvil; no public DAO transaction is claimed. |
| `/bojagi` | Import an issuer-backed private witness, check it against the wallet/credential commitment, generate an eligibility proof in the browser, and locally verify it. Links to Dojang, lending, and legacy Vault. | `ProofGenerationPanel`, `useEligibilityProof`, `useDemoCredential`, witness context, browser Noir/Barretenberg prover. Existing V1 flow uses policy 1 and a configured GIWA registry/Vault context. | Proof generation is local; it is not a chain transaction. The proof exposes wallet, commitment, policy/version/threshold, credential version/expiry, chain, target contract, and proof, while the private value/salt stay in the browser. | No RH-integrated page action. Separate RH V2 proof-context helpers exist in source but this page and its hooks use GIWA. |
| `/lending` | Switch between Robinhood Lending V2 and the separately mounted legacy GIWA V1 demo. V2 exposes market, supply, borrow/collateral, and position flows. | V2 hooks use chain 46630, the isolated RH address registry, RH explorer, policy-3 registry, and RH proof context. V1 continues to use GIWA. | V2 reads and writes use the existing ABI/service, simulation, wallet signature, receipt, event and readback lifecycle. All writes require a verified deployment and RH wallet. No public contract address is currently configured, so the V2 controls remain off. |
| `/contracts` | Lists the Robinhood project deployment inventory, including DAO, and offers bytecode, receipt and event lookups against chain 46630. | `robinhoodContracts` and `RobinhoodEvidenceLookup` use only the RH RPC/client and RH address set. | Code status comes from `getBytecode`; receipt status and events come from transaction receipts; bounded logs are scanned in 2,000-block chunks. Blockscout source verification is not queried. No RH address is currently configured. |
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
| Run DAO Phase 1 on Robinhood | Contract implemented and local lifecycle tested; public use pending. | `RobinhoodGovernancePhase1` is pinned to 46630 and checks project-issued registry policy 4, expiry, revocation, and current `ISSUER_ROLE`. It does not consume official Dojang or Lending policy 3. |

The Robinhood DAO is a **new BOJOGAY-native governance deployment/version**, not a fake official Dojang result or a renamed official credential. Its policy-4 record is checked on chain for subject, commitment, version, issue/expiry, revocation, and current issuer authorization. The existing Robinhood Lending credential is policy 3 and does not grant governance membership. The GIWA contract and frontend behavior remain unchanged.

### B. Bojagi-inspired eligibility and Lending V2

The correct contract order is **credential/proof before proof-gated supply; collateral deposit before enabling collateral; then borrow**. Repayment and safe exits should remain possible without fresh authorization.

| Step | Current status | Robinhood requirement |
|---|---|---|
| Connect wallet | Robinhood Testnet is the primary app network; GIWA remains available for its existing journeys. | V2 selects chain 46630; the legacy V1 flow remains on 91342. Chain 4663 is not enabled. |
| Deploy verifier dependencies and V2 stack | Full-stack and standalone verifier no-broadcast simulations are now available; public deployment pending. The legacy partial V2 script still requires verifier bytecode. | Use `bun run robinhood:stack:simulate` to simulate libraries, linked HonkVerifier, adapter, registry, oracle, tokens, V2 pool and DAO together; use `bun run robinhood:verifier:simulate` for the verifier path alone. |
| Issue a BOJOGAY test credential | Registry and issuer-role grant exist in RH script; not deployed. | Fund distinct admin and issuer accounts; admin deploys registry/grants issuer; issuer submits policy-3 commitment for the borrower/supplier. |
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
| RPC | `appEnv.robinhoodRpcUrl` centralizes the RH RPC; GIWA keeps its own RPC. | Direct read-only RPC verification returned chain `0xb626` (46630), latest block `133624845`, `eth_gasPrice` `10000000` wei, and a no-state-change transfer estimate of `21000` gas during this run. |
| Proof domain | RH V2 hooks use RH-only context creation/validation. | All nine public inputs bind wallet, commitment, policy, version, threshold, credential version/expiry, chain 46630, and exact RH pool. `robinhood-demo-credential-v1` witnesses cannot enter the GIWA V1 witness path. |
| Query keys | GIWA V2 helpers retain 91342. RH market, deployment and credential keys include 46630. | Mutation invalidation uses RH keys and never invalidates GIWA queries. |
| Contract chain guard | `LendingPoolV2` accepts only 91342 or 46630 and checks supplied proof chain against `block.chainid`. RH registry constructor is pinned to 46630. | RH deployment reads check chain, pool code, policy constants, configured registry, adapter, underlying HonkVerifier and oracle addresses/bytecode. |
| Simulation/receipt | RH V2 actions use chain 46630 simulation, gas/fee headroom, wallet write, receipt, event/readback and RH explorer links. | UI writes remain unavailable because no RH addresses are configured. |
| Oracle freshness | `LendingPoolV2` checks missing, out-of-bounds, stale, and future oracle values against reserve configuration. | Deployment initializes bounds but intentionally seeds no price. Operator must separately set synthetic prices; keep freshness failures visible. |
| Mainnet | No RH mainnet connector or deployment profile is part of the current plan. | Do not add chain 4663 to supported write chains absent explicit owner approval and production controls. |

GIWA-specific surfaces remain `useDojangVerification`, official DAO hooks/contracts, Vault and V1 Lending hooks, and the GIWA evidence adapter. They continue to target 91342. RH V2 hooks and evidence are separate and use the chain registry described above.

The RH proof helper is useful but is not an integration by itself: current credential issuance, credential reads, wallet guard, hook query keys, and writes must all agree on the RH registry, chain, and pool address. A proof prepared for a different chain, wallet, policy, credential, or pool must be rejected.

## 5. Project contract and asset inventory

Across current Solidity source there are **11 concrete named contract types and 9 named library definitions** (not counting interfaces or test mocks). Several generated/helper libraries are internal; the complete RH stack simulation deploys `ZKTranscriptLib` and `RelationsLib` for verifier linking. The RH full-stack simulation creates **10 on-chain instances**: those two linked libraries, one Honk verifier, one Robinhood credential registry, one adapter, one test oracle, two controlled test tokens, one LendingPoolV2, and one RobinhoodGovernancePhase1. These are simulation instances only; confirmed public RH deployments remain **zero**.

| Entry | Ownership/type | Network and current deployment | Address/configuration | Dependencies / ABI / use |
|---|---|---|---|---|
| `ZKTranscriptLib` | Project-generated Solidity library | Planned for RH 46630; no public address/receipt. | `RH_TESTNET_ZK_TRANSCRIPT_LIB_ADDRESS`; public display output `NEXT_PUBLIC_ROBINHOOD_ZK_TRANSCRIPT_LIB_CONTRACT`. | Deployed before HonkVerifier, linked at compile/deployment. ABI/artifact is in generated verifier build output. Not a direct UI call. |
| `RelationsLib` | Project-generated Solidity library | Planned for RH 46630; no public address/receipt. | `RH_TESTNET_RELATIONS_LIB_ADDRESS`; public display output `NEXT_PUBLIC_ROBINHOOD_RELATIONS_LIB_CONTRACT`. | Linked to HonkVerifier. Not a direct UI call. |
| `HonkVerifier` | Project-generated proof verifier contract | Planned RH deployment after both libraries; not deployed publicly. | `RH_TESTNET_HONK_VERIFIER_ADDRESS`; public display output `NEXT_PUBLIC_ROBINHOOD_HONK_VERIFIER_CONTRACT`. | Constructor has no Solidity args; verifier bytecode must be linked to both libraries. `EligibilityVerifierAdapter` depends on it. |
| `RobinhoodDemoCredentialRegistry` | Project-owned RH-specific registry | Constructor rejects a non-46630 chain; RH deployment script creates it. Not deployed publicly. | `RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT`. | Admin grants a distinct issuer `ISSUER_ROLE`. RH issuance and credential-read hooks now use this isolated configured address. |
| `EligibilityVerifierAdapter` | Project-owned contract | Planned RH deployment; not deployed publicly. | `RH_TESTNET_VERIFIER_ADAPTER_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_VERIFIER_ADAPTER_CONTRACT`. | Constructor receives the RH HonkVerifier address. V2 pool depends on adapter. |
| `ControlledTestOracle` | Project-owned test oracle | Planned RH deployment; no prices seeded by deployment. | `RH_TESTNET_LENDING_V2_ORACLE_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ORACLE_CONTRACT`. | Admin controls bounds and synthetic prices. V2 reads prices and update timestamps. This is not an external market oracle. |
| `ControlledTestToken` — rUSD2 | Project-owned ERC-20 test asset / lending reserve | One instance planned on RH; no public address. | `RH_TESTNET_LENDING_V2_ASSET_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ASSET_CONTRACT`. | 6 decimals, capped demo supply; used for supplied liquidity and debt. ABI is `controlledTokenAbi`. |
| `ControlledTestToken` — rCOL2 | Project-owned ERC-20 test asset / collateral reserve | One instance planned on RH; no public address. | `RH_TESTNET_LENDING_V2_COLLATERAL_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_COLLATERAL_CONTRACT`. | 18 decimals, capped demo supply; used for collateral. ABI is `controlledTokenAbi`. |
| `LendingPoolV2` | Project-owned multi-reserve lending market | Constructor accepts 91342 or 46630; RH guarded deployment configures two reserves. Not deployed publicly. | `RH_TESTNET_LENDING_V2_POOL_ADDRESS`; `NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT`. | Requires compatible credential registry, verifier adapter, oracle, admin. `lendingPoolV2Abi` powers the V2 UI. `MAX_RESERVES = 8`. |
| `RobinhoodGovernancePhase1` | Project-owned RH-native DAO Phase 1 | Constructor rejects chains other than 46630. Local tests pass; not publicly deployed or connected to the current DAO page. | `RH_TESTNET_GOVERNANCE_ADDRESS`; planned read-only output `NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT`. | Uses policy 4 in the Robinhood project registry. Only governance action changes the DAO's own `minimumRemainingValidity`; no Lending risk control. ABI and integration constraints: [`ROBINHOOD_DAO_FRONTEND_HANDOFF.md`](ROBINHOOD_DAO_FRONTEND_HANDOFF.md). |
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

The typed runtime registry now separates the supported GIWA and Robinhood contract sets by `chainId`, including verifier dependencies, registry, pool, oracle, configured token outputs, and explorer. It never falls back across chains. Public deployment receipt records and reserve activation metadata remain empty until they are sourced from confirmed chain receipts and reads. Do not treat address environment variables as active deployments or reserves.

## 6. `/contracts` page and chain evidence

### Page correction

The active `/contracts` experience is now Robinhood Testnet (46630), contains no official GIWA contract promotion, and displays project-owned RH V2 dependencies, assets and legacy non-RH contracts with explicit boundaries. It consumes only `NEXT_PUBLIC_ROBINHOOD_*_CONTRACT` address config. Addresses link to the Robinhood explorer but are labelled as configuration, not deployment. With the current blank outputs, it reports zero configured Robinhood addresses and no project deployment claim.

Status semantics are deliberately separated:

1. **Not configured** — no valid address was supplied.
2. **Not deployed / no code** — can only be asserted after a chain-46630 RPC bytecode read at a configured address.
3. **Code present** — requires a successful nonempty-bytecode read; it does not establish source verification.
4. **Receipt confirmed** — requires reading the deployment transaction receipt and checking status, address, block, and chain.
5. **Source verified** — requires a Blockscout verification-state read for the exact deployed address/compiler/settings.

The page checks configured-address bytecode on chain 46630, reads arbitrary transaction receipts and scans bounded project-address event ranges. Address configuration remains separate from code presence; receipt lookups confirm only the queried transaction, not that an address is a deployment receipt. Source verification is not queried.

### Existing evidence service behavior

`src/lib/protocol/chain-evidence.ts` is an authentic but GIWA-only read adapter:

- It calls `getChainId()` and rejects any chain other than `91342`.
- `inspectProjectDeployment` checks configured GIWA registry, verifier adapter, Vault, V1 LendingPool, and DAO addresses for runtime bytecode/code hash, then reads selected constructor links. It can discover the generated HonkVerifier and V1 lending/collateral tokens. It does not provide a complete V2/RH inventory.
- `readProjectTransactionEvidence` accepts an arbitrary transaction hash **on GIWA**, reads its receipt/status/gas fields, and attaches only receipt logs whose emitter matches a configured/discovered project contract. It can therefore show a non-project transaction receipt with no project events.
- `readProjectProtocolLogs` scans configured/discovered project addresses over an explicit range, caps the total range at 100,000 blocks, requests chunks up to 10,000 blocks (default 1,000), clamps the end to the latest block, and does not query chain-wide statistics. Scanning can only find events after deployment and within the chosen range.
- Explorer transaction/address URLs use GIWA Sepolia. No Anvil hash is a public GIWA or Robinhood receipt.
- It does not verify Blockscout source status or deployment receipt provenance for an address. A code hash alone is not verification.

The prior `/contracts` implementation invoked the GIWA-only service. The page now uses the separate `src/lib/protocol/robinhood-chain-evidence.ts` adapter: it rejects non-46630 clients, checks bytecode only for configured RH addresses, reads actual receipt and transaction fields, decodes configured registry/oracle/token/V2 pool events, scans at most 100,000 latest-confirmed blocks in 2,000-block chunks, and propagates RPC/rate-limit failures. Explorer links use the RH explorer. Source verification and stored deployment transaction provenance remain unimplemented and are explicitly not claimed.

## 7. Remaining launch blockers

### Must fix before Robinhood Testnet demo

1. **Fund signers.** Owner reports both the deployment admin and separate credential issuer have zero RH test ETH. Fund those accounts and each participating borrower/supplier with test ETH. Do not move keys into `.env` or request them in chat.
2. **Run the complete guarded simulation.** `bun run robinhood:stack:simulate` deploys both libraries, linked HonkVerifier, adapter, registry, oracle, demo assets, V2 pool, and DAO into a no-broadcast simulation. It requires explicit config inputs and does not write addresses to environment files. `bun run robinhood:verifier:simulate` independently checks the verifier-only path.
3. **Approve demo risk parameters.** The full-stack script requires explicit Lending caps, interest/risk values, oracle bounds, and governance timings in `RH_TESTNET_*` fields. The repository's local fixtures use demo-only values; those are not owner-approved deployment parameters or production risk settings. Obtain explicit testnet-demo approval before any deployment.
4. **Complete deployment prerequisites.** Obtain the owner-approved testnet demo values, fund separate admin/issuer and participating wallets with test ETH, run the remote no-broadcast full-stack simulation, then perform actual RPC estimates and a separate deployment authorization review.
5. **Run the guarded no-broadcast simulation.** Use the current RH profile and RPC before any separately authorized deployment. The script refuses other chain IDs and does not broadcast.
6. **Deploy and configure only after separate authorization.** Read every address and successful receipt back from 46630; verify bytecode, pool dependency links, roles, reserve list, oracle bounds and prices; populate public RH address settings only from confirmed records.
7. **Run the public wallet journey after deployment.** Issue policy-3 project credentials to borrower and supplier, deliver witnesses privately, generate proofs bound to chain/wallet/pool, then exercise supply, collateral, borrow, repay, withdrawal and controlled liquidation. Capture receipts and events from the RH RPC.
8. **RPC preflight.** A fresh read-only RPC check returned chain `0xb626`, block `133624845`, gas price `10000000` wei and a simple transfer gas estimate `21000` during this run. Recheck head, rate limits and deployment-specific initcode estimates immediately before broadcast.

### Must fix before any public financial use

- Replace the controlled test oracle and controlled demo tokens with a reviewed production asset/oracle design; remove operator-set synthetic prices from the public financial path.
- Independent security review/audit of the full ZK, token, oracle, lending, interest, liquidation, pause, role, and upgrade/deployment configuration; no audit result is currently claimed.
- Owner-approved and risk-reviewed caps, rate model, collateral factors, oracle freshness/failure behavior, liquidation incentive/close factor, reserve factors, admin/pauser separation, and emergency response.
- Production-grade oracle sources, liveness/heartbeat, decimal normalization, manipulation resistance, asset listing/issuer controls, monitoring, incident controls and operational key custody.
- Formal acceptance of interest accrual/accounting, rounding/dust, share/debt behavior, solvency and liquidation behavior under adversarial boundaries and multiple reserves.
- Robinhood-native DAO frontend integration and deployment; do not reuse official GIWA checks or policy-3 Lending credentials by implication.
- Mainnet remains separately gated at chain 4663 and is not an extension of this testnet demo.

### Optional after the demo

- A configurable multi-market UI/registry beyond the two scripted test assets.
- Add RH chain receipt/event history into the public documentation view after its adapter and tests exist.
- Decide whether to port the legacy Vault or V1 LendingPool. Neither is required for the V2 RH Lending demo.
- Revisit official Dojang support only if a legitimate third-party service supports it on the target network; otherwise keep that integration as GIWA-only history.

## 8. User-facing GIWA references for the product/visual handoff

These are recommendations, not edits in this change. Keep the approved landing visuals, 3D glyphs, scroll behavior, Lenis, layout, typography, and animation untouched. Claude should change only the presentation/copy after the RH hooks and provider have a stable interface.

| Website source | Current GIWA-facing content | Recommendation |
|---|---|---|
| `src/components/site-header.tsx` | GIWA network badge and expected chain 91342. | After RH provider is integrated, show selected supported network and chain ID from wallet state. Do not label a connected RH wallet as GIWA. |
| `src/components/site-footer.tsx` | GIWA setup, Dojang contracts, GIWA explorer, testnet legal copy. | Replace primary network references with BOJOGAY / Robinhood Testnet; retain official GIWA/DoJang docs only as clearly external/historical references if still useful. |
| `src/components/landing/sections.tsx` | GIWA public-state labels, “what GIWA trusts”, GIWA launch status, network facts and GIWA deployment milestones. | Reframe as BOJOGAY-owned credential/proof flows and RH Testnet status. Never imply official GIWA integration is RH runtime authorization. |
| `src/components/landing/cover-reveal.tsx`, `final-reveal.tsx` | GIWA Sepolia title/close copy and GIWA footer links. | Update brand/network copy to BOJOGAY and RH when product integration is ready; preserve the approved animation/3D markup. |
| `src/components/prototype-bar.tsx` | GIWA testnet and “not deployed” status banner. | Update to RH status only after RH deployment state is sourced from verified configuration/receipts. |
| `src/app/dojang/page.tsx` | Correctly describes official Dojang as GIWA-only. | Keep the distinction, but present official Dojang as external GIWA-only functionality and label the Robinhood credential path BOJOGAY-issued. Do not make the project credential look official. |
| `src/app/dao/page.tsx`, `src/components/dao/dao-panels.tsx`, `dao-workspace.tsx`, `proposal-detail.tsx`, `proposal-feed.tsx` | DAO page now offers separate GIWA/official-Dojang and Robinhood/project-policy-4 paths with chain-aware feed and transaction copy. | Preserve the credential boundary. The Robinhood DAO action only changes its own access-policy validity; it does not control Lending V2 risk settings. |
| `src/components/demo-credential-tools.tsx`, `src/components/lending/lending-issuer-tools.tsx` | Issuance/revocation callouts and network conditions name GIWA. | Keep legacy issuer tools GIWA-only; add separate RH issuance controls only when the RH registry hook is integrated. |
| `src/app/bojagi/page.tsx` | Correct disclaimer that it is not GIWA's native private transfer. | Keep the capability boundary, but describe it as BOJOGAY's Bojagi-inspired eligibility proof rather than an implementation of GIWA's transfer system. |
| `src/app/lending/page.tsx`, `src/components/lending-v2/lending-v2-workspace.tsx`, `v2-borrow.tsx`, `v2-eligibility.tsx`, `v2-liquidation.tsx`, `v2-markets.tsx`, `v2-position.tsx`, `v2-status.tsx`, `v2-supply.tsx` | V2 network, not-deployed message, explorer and wallet statuses say GIWA. | After integration, label RH chain, controlled tokens, synthetic oracle and BOJOGAY test credential accurately; keep all demo limitations visible. |
| `src/components/lending/lending-workspace.tsx`, `borrow-view.tsx`, `lending-panels.tsx`, `lending-asset-rows.tsx` | Legacy V1 wallet, explorer and transaction copy says GIWA. | Keep it marked as the legacy GIWA path or hide it from RH flows; do not present V1 addresses as RH V2. |
| `src/components/proof-generation-panel.tsx`, `src/components/vault-action-panel.tsx` | Proof and Vault network prompts say GIWA. | Preserve them as GIWA legacy behavior; do not imply the RH V2 proof path is active on these routes. |
| `src/app/docs/page.tsx` | GIWA deployment pending, live GIWA Dojang, GIWA test results, current route trust model. | Update product/network status and DAO/V2 separation from verified contract integration; retain GIWA as external/historical dependency only. |
| `src/app/contracts/page.tsx` | Shows Robinhood address inventory and chain-46630 bytecode, receipt, and bounded-event evidence, including configured DAO events. | Keep source verification distinct; no contract address or deployment is currently confirmed. |
| `src/components/wallet-network-card.tsx` | GIWA expected-chain labels/status. | Switch to selected supported chain after provider/hook integration; don't update copy to RH before the wallet can actually use RH. |
| `src/components/site-header.tsx`, `src/components/site-footer.tsx` | Global testnet badge and footer references say GIWA. | Show the actually selected supported chain; keep external GIWA links only under an external/historical label. |

The exhaustive source scan also finds GIWA wording in the non-active GIWA evidence components `src/components/evidence/chain-evidence-lookup.tsx`, `project-contract-rows.tsx`, and `use-project-evidence.ts`; they still serve GIWA routes/consumers and must remain GIWA-bound until a separate RH evidence adapter exists. `src/lib/config/env.ts` and `.env.example` still default the global product name to “Private Verifiable State”; the BOJOGAY brand is not yet the configured default and should be applied in the visual/product handoff. In total, the user-facing/runtime source matches occur in the route and component files listed in this section; Solidity, circuit, generated verifier, and historical Markdown matches are implementation provenance, not website copy.

Other `GIWA` strings in circuit identifiers, Solidity chain constants, generated verifier source, historical deployment scripts and historical docs are technical provenance/compatibility and must not be globally replaced. In particular, preserve the official GIWA DAO and GIWA registry path while a separate RH system is designed.

## 9. Exact next implementation plan

This is the dependency-ordered implementation plan. It is not authorization to broadcast or to enable Mainnet.

| Order | Owner | Work and likely files | Acceptance evidence |
|---|---|---|---|
| 0 | Owner + Codex | Approve demo-only financial settings, admin/issuer separation, issuer custody, test token distribution, acceptable centralized oracle assumptions, and operational funding. No private keys in repo/chat. | Written parameter/config approval; funded test wallets confirmed by public address balance reads. |
| 1 | Codex | Make verifier artifact reproducible and add a guarded RH verifier/library deployment simulation path. `circuits/scripts/compile.mjs`, `contracts/src/generated/EligibilityHonkVerifier.sol`, `contracts/script/*Robinhood*`, `scripts/forge-simulate.sh`, `package.json`. | Deterministic compile/conformance; simulation proves exact linked library order/addresses and chain 46630; no broadcast path by default. |
| 2 | Codex | Integrate isolated network and registry: `src/components/providers.tsx`, `src/lib/config/robinhood-testnet.ts`, `src/lib/config/env.ts`, `src/lib/config/contracts.ts`, chain-aware wallet guard and network error states. Keep GIWA available and RH Mainnet absent. | Provider has 91342 and 46630 only; address resolver requires explicit chain; tests reject cross-chain addresses/queries. |
| 3 | Codex | Add RH V2 read/write/issuer/proof hooks using the existing service/ABI: `src/hooks/use-lending-market-v2.ts` or a chain-parametrized service, `src/hooks/use-lending-v2-eligibility-proof.ts`, `src/hooks/use-lending-v2-credential-issuance.ts`, `src/lib/lending/v2-service.ts`, `src/lib/lending/v2-network.ts`, `src/lib/lending/v2-config.ts`. | Test each hook/service with absent address, wrong chain, invalid address, missing code, RPC error, stale/future price, wallet changes, and transaction revert. Query keys include chain, pool, registry, wallet, policy. |
| 4 | Codex | Add read-only Robinhood contract and transaction evidence adapter: new RH-specific service/ABIs or safely generalized read-only evidence functions; configure deployment block metadata only from receipts. | Tests verify chain guard, bytecode state, arbitrary receipt, V2 event decoding, bounded/chunked/latest-clamped scan, empty range, RPC failure, RH explorer URLs, and no Anvil-to-public mapping. |
| 5 | Codex | Deploy preparation and public integration after separate authorization: verifier artifacts, `DeployLendingV2RobinhoodTestnet.s.sol`, deployment console/config, RH address outputs, issuer role, reserve/oracle setup, token allocations. | On authorized testnet run only: every address comes from a successful chain 46630 receipt; bytecode/constructor links/roles/reserves read back; Blockscout source status reported. No predicted addresses. |
| 6 | Claude with stable hooks | Update visual/network copy, landing story, nav/header/footer labels, V2 network notices, Contracts evidence presentation, and responsive controls. Do not change protocol hooks, contracts, circuit or authorization behavior. | Visual review shows BOJOGAY, correct RH testnet, synthetic oracle/test asset/credential disclosures; no official GIWA partnership/credential claim. |
| 7 | Codex + QA/owner | Browser wallet test from issuer, supplier, borrower, liquidator. | Real chain 46630 receipts and state readback for credential, proof, supply, collateral enablement, borrow, repay, safe withdrawal and controlled liquidation. Archive transaction hashes and explorer links. |
| 8 | Owner + Codex, separate future work | Decide if BOJOGAY-native DAO is needed on RH. If yes, specify governance credential policy and create/version a DAO contract with explicit RH authorization. | New authorization/security review, contract tests, deployment review, and a separate decision; never reinterpret the GIWA DAO as RH-ready. |

### Division of work

- **Codex:** protocol contract and verifier deployment preparation, proof/network configuration, chain-aware hooks/services, read-only evidence adapter, receipt-derived deployment registry, integration tests, and deployment documentation.
- **Claude:** page/landing copy and visual integration after the hook contract is stable, including BOJOGAY/Robinhood labels and truthful demo disclosures. Preserve the current typography, glyphs, motion, scroll, and Lending V2 visual work unless separately requested.
- **Owner:** approve risk parameters and operational roles; provide test ETH to public wallet addresses; authorize any eventual deployment transaction separately. No key material is requested or stored here.

## 10. Acceptance tests and proof of completion

### Before first public RH transaction

- `bun run typecheck`, `bun run build`, `bun run contracts:test`, focused RH runtime tests, ZK conformance, and the RH local V2 Anvil lifecycle passed during this handoff. The ZK conformance run required access to the Barretenberg CRS endpoint.
- Fresh `eth_chainId` equals `0xb626` / decimal 46630; obtain block number, gas price, bytecode checks and estimates for exact deployment initcode. Do not trust a prior RPC observation if the endpoint is unavailable.
- Foundry RH profile uses Solidity 0.8.28 and Prague, and simulation refuses chain 91342/Mainnet or any broadcast/signing flag in dry-run mode.
- Recompute proof public inputs and verify policy, wallet, commitment, credential version/expiry, chain and pool address. Change each field independently and show a mismatch is rejected by client and on-chain verifier/pool.
- Verify admin and issuer are distinct and configured roles read back as expected; ensure no price is set until operator deliberately initializes the synthetic test scenario.

### After separately authorized deployment

- For every RH contract: transaction hash, successful receipt, receipt contract address, block number, nonempty bytecode, constructor/dependency readback, and Blockscout source result are recorded. Distinguish “code present” from “source verified.”
- Confirm pool `reserveCount == 2`, exact rUSD2/rCOL2 addresses, caps/flags/risk values match the approved settings, and `MAX_RESERVES == 8` from source.
- Generate and locally verify proof for actual RH user; submit a transaction and confirm the on-chain verifier and pool accept it. Also assert rejection for a GIWA chain proof, wrong user, wrong pool, wrong policy/threshold, expired/revoked credential, and bad private witness.
- Complete actual wallet receipts and readback for supplier eligibility + supply; borrower collateral deposit + proof-gated collateral enable + borrow; interest/health reads; repay; safe collateral exit; unsafe exit rejection; and a controlled oracle-driven liquidation.
- Confirm all transaction links use Robinhood explorer and no local Anvil hash appears as a public-chain result.

## 11. Work performed for this handoff

- The active wallet default is Robinhood Testnet; GIWA remains isolated for official Dojang/DAO and legacy V1/Vault features. RH V2 issuance, proof context, market transactions, cache invalidation and explorer links use chain 46630.
- RH V2 deployment reads now validate configured registry, verifier adapter, oracle and underlying HonkVerifier addresses against the pool/adapter and confirm dependency bytecode before treating the deployment as compatible.
- `/contracts` uses authentic RH bytecode and transaction receipt reads plus bounded V2 event scanning. It does not claim source verification or a public deployment.
- `.env.example` now documents RH RPC, separate admin/issuer inputs, explicit demo/governance simulation parameters, and DAO deployment outputs. Address outputs remain blank; the real `.env` and `.env.local` were not edited.
- Added `RobinhoodGovernancePhase1`, pinned to chain 46630, using project-issued registry policy 4. It checks current issuer role and credential expiry/revocation and only changes its own protected-access validity setting. GIWA governance, DAO hooks, Lending V2 mechanics and circuits were left intact.
- Added independent verifier and complete stack deployment simulations. The verifier linker checks compiler-generated library placeholders by name; it does not reuse GIWA or Anvil addresses. The full stack requires explicit governance and financial configuration and leaves oracle prices unset.
- `bun run contracts:test` passed 90/90; `bun run typecheck` and `bun run build` passed; `bun run zk:conformance` passed with CRS access. `bun run robinhood:protocol:anvil` passed the policy-4 DAO flow and real proof-backed Lending V2 flow on an isolated chain 46630. Both the full-stack simulation and standalone verifier simulation exited successfully without broadcast.
- Read-only Robinhood JSON-RPC checks confirmed chain ID `46630`, block `133624845`, gas price `10000000` wei, and a simple transfer estimate of `21000` gas at the time checked. These values are time-sensitive and do not estimate deployment initcode.
- The first CRS fetch and localhost-binding attempts were restricted; permitted read-only/local retries passed. These are local validation results, not public-chain evidence.
- No ZK circuit, Lending execution logic, environment secret, frontend file, public transaction, commit, or push was changed/performed. Page layout, theme, landing design, typography, animation, and 3D effects were untouched. No Robinhood deployment is confirmed; remote initcode gas estimates and funded testnet wallet balances remain unverified.

