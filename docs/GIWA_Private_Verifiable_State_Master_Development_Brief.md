# PRIVATE VERIFIABLE STATE PROTOCOL
## Master System Design & Development Brief — Agent-Agnostic

**Version:** 1.0  
**Date:** 2026-10-09  
**Status:** Approved product direction; implementation and deployment NOT yet completed  
**Primary reference:** GIWA (https://giwa.io)  
**Target network:** GIWA Sepolia (EVM testnet)  
**Target delivery:** 2–3 days for a constrained, working proof of concept, subject to ZK and deployment feasibility

> **Mission:** Build a verifiable privacy application that lets a wallet demonstrate it satisfies a trusted eligibility requirement without publishing the underlying private value, then execute a real, permissioned on-chain action.

> **Positioning:** Prove more. Reveal less.

---

## 1. How Every AI Agent Must Use This Brief

This document is the **single source of truth for product behavior, system boundaries, user flows, architecture, and acceptance criteria**. It is intentionally independent of any particular IDE, AI model, monorepo template, or frontend framework. An implementation agent must inspect the existing repository before choosing file paths or making architectural changes.

**Operating order:** (1) understand requirements and external contracts; (2) inspect repository and test environment; (3) implement the smallest end-to-end verified path; (4) test negative and positive cases; (5) connect polished UI only to real states; (6) document evidence and limitations.

**Do not** invent deployed contracts, transactions, official certifications, balance data, ZK capabilities, or successful tests. Label every fallback and demo fixture explicitly. Report blockers rather than silently substituting frontend simulation for cryptographic or on-chain enforcement.

**Scope guard:** This brief specifies SYSTEM DESIGN and FUNCTIONAL WORKFLOWS, not a finished visual identity. A separate designer/agent may own appearance without changing security logic, user states, or contract semantics.

## 2. Product Decisions (Locked)

| Area | Decision |
| --- | --- |
| Category | Web3 verification and privacy infrastructure / application |
| Product concept | Private Verifiable State Protocol |
| Primary features | Dojang Verification; Bojagi-inspired Protection |
| Reference, not clone | GIWA Dojang for attestation; GIWA Bojagi for privacy principles |
| Flagship proof | Private Eligibility Proof |
| Application | Restricted Vault: a gated on-chain action, **not a deposit/yield product** |
| Blockchain | GIWA Sepolia only for MVP; **chain ID 91342** |
| Execution | Real smart contracts, real wallet-signed transactions, real on-chain verification |
| Privacy target | Hide exact private eligibility value from public calldata and logs |
| Visible on-chain | Wallet address, policy, commitment, proof-validation-related public inputs, transaction metadata, access result |
| Main pages | `/`, `/dojang`, `/bojagi`, `/vault`, `/contracts`, `/docs` |
| Markets page | Not part of MVP: no real markets, pools, trading, or yield positions |
| Security status | Testnet demonstration only; no production/audit claims |
| Implementation technology | Not locked by this brief; EVM-compatible libraries required |

**Terminology rule:** The product integrates or draws inspiration from GIWA components. Unless authorized and technically integrated, do not present our private-eligibility proof as GIWA's native Bojagi private-transfer system. Use **“Bojagi-inspired Protection”** where the distinction matters.

## 3. What the Two Features Actually Do

### 3A. DOJANG — VERIFY

**User promise:** “Check whether my wallet has a valid credential from a recognized issuer.”

Dojang is GIWA's EAS-based attestation layer. For a supported wallet, the app reads **official Dojang** status from GIWA Sepolia. It should show issuer, attestation UID, validity, expiration and revocation when available. This operation is generally **read-only**: connecting a wallet or querying Dojang does **not** magically issue an official credential.

- Preferred public example: official `Verified Address` query via `DojangScroll.isVerified(wallet, attesterId)` and `getVerifiedAddressAttestationUid(...)`, with EAS `getAttestation(uid)` for metadata.
- A wallet with no official attestation must display **“Not Verified”** or **“No Credential Found”**; network errors display **“Unable to Check”**, not “Not Verified”.
- A test-issuer credential is a **separate Demo Credential**, NEVER an official Dojang attestation or proof of real-world KYC/holdings.
- Official Dojang `Verified Balance` publicly includes `uint256 balance`; **do not claim this particular public attestation hides the balance**.

### 3B. BOJAGI-INSPIRED PROTECTION — PROVE

**User promise:** “Prove that my issuer-backed private state meets a policy without submitting its exact value on-chain.”

- Display an eligibility policy, e.g. **Minimum verified demo balance: 1,000 test units**.
- Load an **issuer-issued** private witness (value, randomness/salt, and supporting credential metadata). Arbitrary user-entered amounts MUST NOT be accepted as trustworthy evidence.
- Locally construct a genuine ZK proof of `(privateValue >= policyThreshold)` **AND** correct binding to a trusted on-chain commitment.
- Submit proof plus public inputs to a real contract. The contract independently checks the issuer-backed commitment, wallet/policy binding, validity and ZK verifier result.
- Execute `enterVault(...)` only if all checks pass. Emit an on-chain access event and save contract state.
- This is **eligibility privacy, not transaction privacy**: wallet address, transaction existence and potentially the access decision remain observable.

### 3C. RESTRICTED VAULT — REAL UTILITY

The vault is the demonstration of what private proof **enables**. It is an on-chain access gate, **not** a financial vault holding user deposits in MVP. It has a meaningful state-changing transaction, for example `hasAccess[wallet] = true` and `VaultAccessGranted(wallet, policyId)`.

A React-only “Access Granted” message does **not** count. An invalid or expired proof MUST revert on-chain. Do not introduce custody, deposits, swaps, interest or yield before the core verification flow works.

## 4. System Architecture and Trust Boundaries

```text
                    USER / EVM WALLET
                           |
                 Connect + network check
                           |
                     FRONTEND DAPP
                 /         |          \
                /          |           \
       DOJANG READ       PROVER       CONTRACTS + EXPLORER
            |               |                  |
    Official Dojang     Private witness      GIWA Sepolia
    DojangScroll/EAS    + public inputs           |
            |               |          +------------------------+
    Status/UID/issuer    ZK proof        | DemoCredentialRegistry |
            |               |          | On-chain Verifier      |
            +----------- user flow ---->| RestrictedVault        |
                                       +------------------------+
                                                  |
                                      Real event + state change
```

**Two distinct trust anchors:**

1. **Official Dojang source:** trust a specifically selected GIWA attester when reading official `Verified Address`. This can be independently inspected via GIWA contracts. Official issuance might be unavailable to arbitrary test wallets.
2. **Demo private-state issuer:** a clearly labeled project-controlled issuer issues a cryptographic commitment for the demo witness. The smart contract trusts only explicitly authorized issuer(s). This proves **issuer-backed demo eligibility**, NOT verified exchange holdings.

Do not quietly merge these statuses. If the user lacks official Dojang verification, the user may still exercise the **separately labeled Demo Vault path** using a demo credential. If a future policy explicitly requires official Dojang verification, the contract must enforce the official status on-chain, not merely the UI.

**Preferred end-to-end testable architecture for MVP:**

- The issuer creates a *fixed or issuer-determined* test-state record for a wallet, with a fresh unpredictable secret/salt.
- The issuer registers its commitment, wallet binding, issued/expiry metadata and revocation status in an on-chain contract under an authorized issuer role. No private balance is stored on-chain.
- The user securely obtains their corresponding private witness (demo credential file or another explicit test delivery mechanism).
- The ZK circuit proves the witness matches the registered commitment and passes the threshold; the public inputs bind it to wallet, policy, chain and intended action/contract.
- The vault checks `msg.sender` against the proof's wallet, checks the commitment is currently authorized/unrevoked/unexpired, validates public policy inputs against current contract configuration and verifies the ZK proof.
- Only then does the vault update state and emit an event.

**Implementation notes:** Choose a hash/commitment construction supported in both the circuit and the on-chain registry; domain-separate the committed data; use high-entropy salts; decide exact integer units explicitly; do not hash ambiguous concatenations; test circuit-to-contract public-input order byte-for-byte.

## 5. Six Pages: Purpose, Data, Actions, States

### `/` — Home

- In 10 seconds, explain: **Verify trusted state → prove eligibility privately → unlock an on-chain action**.
- Entry points: `Explore Dojang`, `Generate Proof`, `View Contracts`, `Read Docs`.
- Show that this is a **testnet demonstration**, not an audited financial product.
- No fake markets, TVL, APY, performance charts, or invented protocol activity.

### `/dojang` — Verification

- Wallet connect; chain check; official Dojang Verified Address query; issuer details, UID and validity when present.
- Differentiate `Official Verified`, `No Official Credential`, `Expired/Revoked`, `RPC Error`, `Demo Credential Issued`.
- Show optional test-issuer onboarding for the demo flow, separate from official Dojang.
- CTA to `/bojagi` only when the relevant eligibility demo credential exists; otherwise guide user to valid issuance/import.
- Never depict local demo eligibility as official Upbit/GIWA verification.

### `/bojagi` — Private Eligibility Proof

- Explain the policy (sample: `>= 1,000 verified test units`), current credential type, privacy limits and public inputs.
- Validate matching wallet, credential expiry/revocation and chain before allowing proof generation.
- Generate proof, perform optional **local** verifier precheck, and submit to on-chain verifier via the vault action.
- Distinguish `Proof Generated` from `Proof Verified On-chain` and `Vault Action Confirmed`.
- Expose no exact witness value through public logs, analytics, URL, transaction args or events.
- If no browser proof support, a server/CLI prover may be used **only as a clearly flagged demo fallback**; explain that sending a witness to a server changes privacy properties. No hidden upload.

### `/vault` — Protected Action

- Show active policy, eligibility requirement, proof readiness and **on-chain access state**.
- Main action: `Enter Vault`. This triggers a wallet transaction calling contract enforcement, not local navigation alone.
- Show transaction lifecycle: simulation, wallet confirmation, submitted, confirmed, reverted/rejected.
- Show explorer link and the access event after confirmation.
- If proof is invalid/expired/revoked/wrong-wallet or user is on wrong chain, block submission or explain the on-chain rejection.
- Do not handle real deposits, liquidity, withdrawals or custody.

### `/contracts` — Verifiable Contract Evidence

Separate:

1. **GIWA infrastructure**: official addresses and links for DojangScroll, EAS, and any other **actually used** GIWA contracts.
2. **Our deployed contracts**: DemoCredentialRegistry, EligibilityVerifier (or generated verifier + wrapper), RestrictedVault, and optional explicit adapter(s).

For our contracts show chain, address, verified source status, role, ABI-supported read functions, most important state-changing functions, deployment transaction, explorer links, events and real transaction hashes. A contract that is **not yet deployed** must say so—never show example addresses as if real.

This page is not merely an address registry. It must make evidence of **real on-chain verification and execution** discoverable. Admin/issuer write functions are not exposed to unauthenticated users.

### `/docs` — Architecture and Public Limitations

- Protocol overview; Dojang vs Bojagi-inspired boundary; wallet/credential/proof/vault flows.
- Issuer trust model; public vs private fields; demo data provenance; contract responsibilities; network/explorer links.
- Exact limitations: no native Bojagi private transfer, no hidden sender/receiver, no private financial balances from GIWA Verified Balance attestation, no audit, no real DeFi market/custody.
- How to run a reproducible local demo and verify explorer evidence.

## 6. End-to-End User Flows and Branches

### Flow A: Official Dojang inspection

```text
Open /dojang
  -> Connect EVM wallet
  -> Verify chain 91342
  -> Read DojangScroll for selected official attester
  -> If found: fetch UID + EAS metadata; validate identity/expiry/revocation
  -> Display OFFICIAL verified result + provenance
  -> Else: display NO OFFICIAL CREDENTIAL, not a fabricated success
```

### Flow B: Demo credential issuance/import

```text
Open demo onboarding
  -> Explain that this is a project-controlled test issuer
  -> Bind issuance to connected wallet (signed request or controlled fixture)
  -> Issuer determines test value; creates salt and commitment
  -> Authorized issuer registers commitment on GIWA Sepolia
  -> User obtains private witness securely
  -> UI confirms issued credential matches wallet + on-chain commitment
```

**Minimum usable onboarding:** A documented CLI issuer for a preselected demo wallet plus a credential import flow is acceptable if a self-service issuer would jeopardize the 2–3 day delivery. A small authenticated test issuer service is optional, not inherently required. Never commit sample secrets or live issuer keys to a public repository. For reproducibility, use only disposable test wallets and explicitly labeled synthetic values.

### Flow C: Proof and gated action

```text
Open /bojagi
  -> Pick existing policy, e.g. >= 1,000 test units
  -> Check eligible credential exists and remains valid
  -> Generate real ZK proof from PRIVATE witness
  -> Check proof matches PUBLIC commitment + wallet + policy + vault + chain
  -> Navigate to /vault (or continue in one guided flow)
  -> Submit enterVault(proof, publicInputs)
  -> Contract checks issuer, validity, identity, policy, verifier
  -> If valid: update access state + emit event; show tx explorer link
  -> If invalid: revert; show precise user-facing error
```

### State & failure matrix

| Condition | Expected behavior |
| --- | --- |
| No wallet installed | Show supported EVM wallet options and installation guidance |
| Wallet disconnected | Read-only pages usable; write/prove flow requires connection |
| Wrong network | Offer network switch; no wrong-chain writes |
| Official Dojang credential missing | Explicit `No Official Credential`; demo path separately labeled |
| RPC timeout / provider outage | Retryable error, never false negative or false verified |
| Demo credential missing | Guided issuance/import, no fabricated proof |
| Credential wallet mismatch | Reject before proving and on-chain |
| Expired/revoked credential | Reject at contract, reflect in frontend |
| Threshold not met | Proof generation unsatisfied or proof rejected; no access |
| Tampered proof/public inputs | Verifier fails; access state unchanged |
| Wrong policy/chain/vault | Contract rejects mismatched binding |
| Wallet rejects signature/tx | Clear cancellation state, no success claim |
| Insufficient testnet ETH | Show gas/faucet guidance, no fake confirmation |
| Duplicate entry | Idempotent read or explicit already-granted behavior; no accidental replay |
| Proof expires / contract policy changes | Proof invalidated or needs regeneration according to enforced policy version |
| Transaction pending/reverted | Track receipt; only confirm access after successful chain receipt and readback |

## 7. Smart Contract Responsibilities (NOT Just Registry)

**A. `DemoCredentialRegistry` (custom; demo issuer trust)**

- Authorized issuer writes credential commitment, associated wallet, issuance/expiry and status.
- Support revocation and a read view to check current active commitment.
- Reject unauthenticated issuance, zero-address recipients, invalid expiry and malformed records.
- Emit `CredentialCommitted` and `CredentialRevoked` events without private balances.
- Permit one active version per wallet/policy or define deterministic credential versioning.

**B. `EligibilityVerifier` (real ZK verifier)**

- Verifies proof against a verification key/circuit that genuinely enforces commitment matching AND `privateValue >= threshold`.
- Use a generated Solidity verifier consistent with the proving backend; a dummy `return true` implementation is explicitly forbidden.
- Bind public inputs deterministically; test positive and malicious cases.

**C. `RestrictedVault` (custom; execution)**

- `enterVault(proof, publicInputs)` executes the **atomic** eligibility checks and successful state change in ONE on-chain transaction.
- Enforce `msg.sender`, currently trusted commitment, issuer policy, threshold/policy version, credential expiration and revocation, expected chain/contract binding, and verifier outcome.
- Maintain `hasAccess[wallet]` and emit `VaultAccessGranted` only on success.
- Prevent replay or duplicate reward/entry if relevant. For a once-per-wallet access grant, an explicit access flag suffices for that specific action; additional repeatable actions require nonce/nullifier design.
- No token transfer, no escrow, no ETH deposits in MVP.

**D. `DojangReader` / adapter (optional custom wrapper)**

- Reads official GIWA `DojangScroll` and/or EAS if a policy actually requires official attestations on-chain.
- **If the vault UI claims official Dojang status is a mandatory requirement, it MUST be enforced by the vault contract.** Do not gate official status only in React.
- Not required for the basic demo credential-only policy, as long as the distinction remains explicit.

**Implementation note:** It is acceptable to consolidate a registry, policy and vault where security remains clear; contract names are logical responsibilities, not mandatory file names. Generated verifier contracts may be separate for tooling reasons.

## 8. Data and Cryptographic Contract

**Private witness (never on-chain):** `privateValue`, `salt`, and any private authentication data necessary for the chosen commitment proof.

**Public/state inputs (potentially on-chain):** `walletAddress`, `credentialCommitment`, `issuer/registry`, `policyId`, `threshold`, `credentialVersion`, `expiration`, `chainId`, `vaultAddress`, and proof bytes. Exact form depends on selected proving backend.

The ZK circuit MUST establish at least:

1. The witness produces the issuer-authorized commitment under a specified domain-separated hash construction.
2. The private value is an integer within its intended range and meets the exact public threshold.
3. The commitment is bound to the expected wallet and credential/context, not reusable across arbitrary wallets.
4. Public context (policy/version and intended contract/chain, as designed) cannot be substituted after proof generation.

The contract MUST independently check:

- `msg.sender == publicWallet` (no proof reuse by another caller).
- The public commitment equals an **active, trusted issuer-controlled on-chain record**, and it is not expired or revoked.
- Threshold and policy ID/version equal authoritative contract state (user cannot lower threshold).
- Chain and target action are bound correctly (no cross-chain/cross-app replay).
- Cryptographic verifier confirms proof validity.

**Privacy caveats:** A salted commitment hides a high-entropy witness against casual inspection but does not automatically guarantee full application privacy. Proof outputs still reveal that a policy was satisfied; addresses, events, network metadata and issuance relationships can remain linkable. Use synthetic credentials only; keep secrets out of telemetry, browser storage defaults, server logs and deployment files.

## 9. Technology Selection Principles (Flexible, Not Prematurely Locked)

The implementation agent should propose its choices after inspecting the repo and verifying the exact version compatibility. Required **capabilities** matter more than brand names:

- Frontend: React + TypeScript with route structure above; Next.js App Router is a reasonable default if starting from scratch, but not a product requirement.
- EVM wallet and chain reads/writes: maintained EVM wallet connector plus `viem` (and optionally `wagmi`). Do **not** use Solana wallet adapters for GIWA.
- Smart contracts: Solidity with Foundry or an equivalent tested EVM workflow.
- Attestation: Official GIWA DojangScroll + EAS read integration; separate demo credential authority for private witness.
- Zero knowledge: Noir + Barretenberg is a strong candidate because official tooling supports proof generation and Solidity verifier generation; another auditable, maintained EVM-compatible proving tool may be used with equivalent end-to-end tests.
- Backend: none by default for reads; a minimal explicit trusted demo issuer is acceptable when required to issue credentials securely. Never claim server-side witnessing preserves client secrecy.
- Indexing: direct RPC + indexed events or explorer APIs is enough for MVP; do not introduce complex databases without evidence of need.

**GIWA Sepolia reference configuration:** chain ID `91342`; public RPC `https://sepolia-rpc.giwa.io` (documented as rate-limited), explorer `https://sepolia-explorer.giwa.io`. Official Dojang contract addresses/ABIs MUST be imported from official docs and checked before deployment; do not guess from examples.

## 10. UI Behavior Contract (Design Agent Can Restyle)

Design does not change state semantics. All user-facing interface text is English. The following state labels must be distinguishable:

**Wallet:** `Disconnected`, `Connecting`, `Connected`, `Wrong Network`.

**Dojang:** `Checking`, `Official Verified`, `No Official Credential`, `Expired`, `Revoked`, `Read Error`; separately, `Demo Credential Ready`.

**Proof:** `Credential Required`, `Ready to Prove`, `Generating Proof`, `Proof Generated`, `Proof Invalid`, `Ready to Submit`.

**Transaction:** `Awaiting Signature`, `Submitted`, `Confirming`, `Confirmed`, `Reverted`, `Rejected`, `RPC Error`.

**Vault:** `Locked`, `Eligible`, `Access Granted`, `Previously Granted`.

Use human-readable failure explanations and a link to the relevant transaction/attestation, where real data exists. A green check icon or progress animation is NEVER itself proof of successful on-chain execution.

## 11. Testing & Acceptance Criteria

### Contract/unit tests

- Authorized issuer can register and revoke demo commitments.
- Unauthorized account cannot issue or revoke credentials.
- Good witness + active commitment + correct threshold generates a verifiable proof.
- Under-threshold witness cannot produce an accepted proof.
- Tampered proof, wrong commitment and wrong public-input ordering are rejected.
- Wrong wallet, wrong chain/target context and mismatched policy version fail.
- Revoked/expired credentials fail even if previously proven.
- Contract enforces verification **inside `enterVault`** and updates access only after success.
- Repeat entry is idempotent or explicitly rejected per documented contract semantics.
- Emitted events expose no private witness value.

### Frontend/integration tests

- Correctly differentiates official Dojang attestation from demo issuer credential.
- Handles not found, revoked, expired and RPC error cases.
- Handles no wallet, wrong network, rejected signature and insufficient funds.
- Shows transaction hash only after submission; only shows `Confirmed` after receipt success.
- Reads granted access back from contract after refresh/reconnect.
- No simulated proof or hardcoded access success in production paths.

### Deployment evidence required

- GIWA Sepolia contract addresses with correct chain.
- Source-verified contracts on GIWA explorer, or an explicit truthful verification failure report.
- Example success transaction hash and receipt.
- Example failure test showing invalid access is rejected (local or testnet, explicitly labeled).
- Relevant event name and its transaction/explorer link.
- Executed test/build/typecheck commands with actual outputs.
- Documented prover/circuit version and verifier compatibility.

**MVP passes ONLY IF:** a wallet uses a trusted **demo** private credential, creates a real proof, the contract verifies it, access state changes on GIWA Sepolia and the user can inspect the evidence. Official Dojang inspection should also function as a separate feature, whether or not that wallet has official eligibility.

## 12. Build Order: Critical Path for 2–3 Days

### Day 0 / preflight — Blocker check

- Confirm GIWA RPC/explorer and testnet ETH access; inspect existing repo.
- Confirm official Dojang calls return correctly for both present/absent cases, where test addresses are available.
- Create tiny ZK spike: compile circuit, produce valid and invalid proofs, generate EVM verifier, verify locally, and estimate deployment feasibility.
- **Go/no-go:** If the proving backend cannot deploy and verify on GIWA within the timebox, report a blocker instead of manufacturing green UI states.

### Day 1 — Trusted state + on-chain skeleton

- Wallet/network setup and Dojang read integration.
- Implement/demo issuer-controlled commitment registry.
- Write vault policy and the real `enterVault` enforcement skeleton.
- Add tests for unauthorized issuance, invalid status, wallet binding and policy rules.
- Deliver: read-only official verification and issuer-backed test credential path.

### Day 2 — Real zero-knowledge pipeline

- Implement circuit and commitment matching; lock public input definitions.
- Generate correct EVM verifier; integrate with vault; test valid/invalid/expired/revoked scenarios.
- Deploy contracts to GIWA Sepolia and verify sources where supported.
- Deliver: real on-chain positive and negative proof paths.

### Day 3 — Product integration and evidence

- Wire `/dojang`, `/bojagi`, `/vault` to contracts; implement transaction lifecycles.
- Create `/contracts` with deployed addresses, explorer and event evidence; `/docs` with security boundaries.
- Finish landing flow; add responsive polish only after functional gates pass.
- Run tests, typecheck, lint, production build and wallet smoke test; hand over verified tx hashes.
- Deliver: reproducible under-two-minute demo that tells the truth about privacy and issuer provenance.

**Schedule flexibility:** 2–3 days is a target, not a security claim or guarantee. If time compresses, prioritize a real circuit/verifier/vault + official Dojang read over extra pages' visual sophistication. Never make invalid proofs pass to meet deadline.

## 13. Explicit Non-Goals

- GIWA chain/L2 recreation.
- Native GIWA Bojagi private transfers or claims of integration without published/verified interfaces.
- Privacy for sender/receiver, transfer amount or entire transaction graph.
- A real fund-holding vault, token transfers, yields, markets, APY, TVL or lending operations.
- Real KYC onboarding or pretending a local test issuer is Upbit.
- A new cryptographic proving scheme, unaudited financial security guarantees, mainnet deployment.
- Full decentralized identity ecosystem, cross-chain operation, backend microservices, or unnecessary infrastructure.

## 14. Open Implementation Decisions (Agent Must Record)

The following are **not** fixed by product direction. The implementing agent must choose and justify them without modifying the promised behavior:

1. Existing repo/framework or new React/Next.js project; package manager.
2. Exact ZK prover/circuit versions and browser vs local/CLI proof generation; whether fallback changes privacy assumptions.
3. Trusted demo credential delivery mechanism (CLI fixture vs secure authenticated demo issuer).
4. Commitment hash/circuit encoding, expiry policy and credential versioning.
5. Whether official Dojang verification is **informational** in MVP or a separate additional on-chain policy, depending on issuer availability.
6. The precise vault action and replay behavior while preserving proof-enforced state change.
7. RPC provider and explorer index strategy, respecting public RPC rate limits.

If a decision changes trust/privacy semantics, **document it prominently and get explicit product approval before claiming the feature is complete**.

## 15. Required Handoff Format for Every Agent

Every implementation agent must finish work by reporting:

1. **Completed:** functional changes and affected pages/contracts, not marketing statements.
2. **Architecture:** concise flow and how issuer trust is enforced.
3. **Files changed:** real paths and why; avoid unrelated modifications.
4. **Contracts:** exact deployed addresses, network, verified-source status, and explorer links; clearly distinguish official GIWA and our contracts.
5. **Evidence:** successful and invalid proof test outputs, on-chain tx IDs and emitted events.
6. **Checks:** actual build, test, lint, typecheck results and blockers.
7. **Known limitations:** demo issuer, privacy leakage boundaries, native Bojagi scope and pending work.
8. **Next step:** one bounded, prioritized implementation task.

---

## 16. Authoritative References

- GIWA product overview (official Dojang / Bojagi descriptions): https://giwa.io/home
- Dojang overview: https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang
- Official Dojang verified-address integration tutorial: https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/verified-address
- Official Dojang contracts and attesters: https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts
- Official Dojang source and schemas: https://github.com/giwa-io/dojang
- GIWA Sepolia setup, chain ID and rate-limit notice: https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa
- Noir proving workflow: https://www.noir-lang.org/docs/getting_started_manually
- Barretenberg Solidity verifier: https://barretenberg.aztec.network/docs/how_to_guides/how-to-solidity-verifier/

**Research boundary:** The links above establish public reference behavior, not a claim that GIWA's production/private Bojagi system is accessible as an SDK. Independently check on-chain contract and SDK availability before integrating or describing anything as native Bojagi functionality.

---

### Short instruction to paste above this brief into any AI coding agent

> Read this brief as the project's product and system contract. Start by inspecting the existing repository and verifying GIWA/Dojang/ZK feasibility. Implement one genuinely working end-to-end testnet path first. Do not invent official attestations, live balances, proofs, deployments, results, or privacy guarantees. Follow the locked six-page scope, distinguish official Dojang from the demo issuer and Bojagi-inspired ZK proof, use real on-chain enforcement, test failures, and report file-level changes plus explorer evidence before marking work complete. Ask for a product decision only if it changes the security/trust model; otherwise make a conservative documented engineering choice.
