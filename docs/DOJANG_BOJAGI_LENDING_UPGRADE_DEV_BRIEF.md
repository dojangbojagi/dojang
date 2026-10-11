# Development Brief: Upgrade to Dojang + ZK-Powered Lending & Borrowing

**Project repository:** https://github.com/dojangbojagi/dojang\
**Primary network target:** GIWA Sepolia (EVM testnet)\
**Document type:** Product, engineering, UX, security, and acceptance
specification\
**Status:** Implementation brief --- inspect current repository before
changing code\
**Priority:** Make Lending & Borrowing genuinely functional on-chain,
with real Dojang integration and a working ZK eligibility layer\
**DAO scope:** Phase 1 proof-of-concept now; Phase 2 is a required
roadmap milestone to execute only after Lending/Borrowing and DAO Phase
1 are complete and reported to the project owner.

------------------------------------------------------------------------

## 0. Instructions to the Development Agent

Treat this document as the target direction for upgrading the existing
repository. Do not rebuild the application from scratch or blindly
replace existing working components.

Before implementation:

1.  Inspect the current repository, routes, contracts, circuit, hooks,
    tests, package scripts, environment variables, and documentation.
2.  Produce a short inventory of what already works, what only works
    locally, what is UI-only, what is deployed, and what is unverified.
3.  Preserve reusable components and tests where possible.
4.  Create a staged implementation plan, then implement the
    highest-priority end-to-end path.
5.  Do not claim a contract is deployed, an attestation is official, a
    proof is verified on-chain, or a transaction succeeded without
    evidence.
6.  Do not substitute a hardcoded status, mock API, arbitrary
    user-entered balance, or frontend-only simulation for real protocol
    enforcement.
7.  If a required official Dojang/UPbit capability cannot be accessed,
    report the exact blocker and provide a clearly labelled test-only
    fallback for development. Never describe that fallback as official
    GIWA/UPbit verification.
8.  Run tests and include the commands, results, deployment addresses,
    transaction hashes, and explorer links in the final report.
9.  Do not begin DAO Phase 2 until the owner has been informed that
    Lending/Borrowing and DAO Phase 1 have met their acceptance criteria
    and has confirmed the Phase 1 completion report.

**Implementation priority:** correctness and evidence first; polished UI
second; optional features last.

------------------------------------------------------------------------

# 1. Product Direction

## 1.1 Product definition

Build a DeFi Lending & Borrowing protocol on GIWA Sepolia that combines:

-   **Dojang-based verification:** use official GIWA Dojang attestations
    and supported issuer data wherever technically available.
-   **Bojagi-inspired ZK eligibility:** prove that a user satisfies a
    policy without exposing unnecessary underlying private data.
-   **Real lending mechanics:** supply, withdraw, collateral management,
    borrow, repay, interest accrual, oracle-based valuation, health
    factor/LTV, and liquidation.
-   **DAO Phase 1:** a small but real on-chain governance
    proof-of-concept using the official Dojang membership rule defined
    for the project.
-   **DAO Phase 2:** a more advanced private/reputation-based governance
    system, planned in detail later in this document and intentionally
    deferred until Phase 1 is complete.

The project is **not** a clone of GIWA, Dojang, or Bojagi. It is an
application that integrates official Dojang where supported and builds
its own ZK eligibility layer inspired by the privacy direction of
Bojagi.

## 1.2 Product promise

Suggested product message:

> **Verify financial eligibility. Keep sensitive data private. Access
> on-chain lending.**

This statement must be adjusted to the actual privacy guarantees of the
deployed system. It must not imply that every transaction field, wallet
address, lending position, or relationship between wallets is private
unless that functionality has actually been implemented and
independently verified.

## 1.3 Mandatory product rules

1.  Every user must pass the project's configured Dojang verification
    and ZK eligibility process before initiating risk-increasing lending
    actions.
2.  Dojang and ZK must be functional protocol components, not visual
    badges.
3.  The lending system must behave like a real DeFi lending protocol,
    not just a demo that toggles a `hasAccess` flag.
4.  Official Dojang credentials and project-issued test credentials must
    never be conflated.
5.  A project-issued test credential is not proof of real-world assets,
    official KYC, or Upbit account ownership.
6.  Balance eligibility and on-chain collateral are separate concepts.
    An exchange balance credential does not give the lending contract
    control over exchange assets.
7.  Eligibility failure, credential expiry, issuer downtime, or ZK
    service failure must not trap users' existing funds or prevent
    essential debt-reduction/position-safety actions.
8.  Phase 1 is testnet software. Do not market it as audited or safe for
    real funds.
9.  UI copy may be premium and confident, but it must not falsely imply
    GIWA/Upbit endorsement, official affiliation, or identical
    implementation to native Bojagi.
10. Use official GIWA Dojang contracts and attestations only after
    verifying the current GIWA Sepolia deployment, schemas, attester
    IDs, and read semantics.

------------------------------------------------------------------------

# 2. Existing Repository: Required Starting Point

The current repository is documented as a Next.js App Router application
with routes:

-   `/`
-   `/dojang`
-   `/dao`
-   `/bojagi`
-   `/vault`
-   `/lending`
-   `/contracts`
-   `/docs`

The existing README describes separate journeys for official Dojang
verification/DAO and project-issued credential/ZK/Lending. It also
describes `/vault` as a secondary technical demo. Previous documentation
states that the project's own contracts had not been deployed in that
checkpoint, and local tests/build results are not evidence of on-chain
deployment.

These are starting observations, not assumptions about the current
working tree. Re-check repository state before making decisions.

## 2.1 Preserve and evolve routes

-   `/lending`: upgrade to the flagship, full Lending & Borrowing
    application.
-   `/dojang`: make this the clear verification/credential status page
    and balance-verification entry point.
-   `/bojagi`: retain as a ZK explanation/proof status page, but connect
    it to the actual Lending policy and proof flow. Avoid a disconnected
    demo.
-   `/dao`: retain as Phase 1 governance proof-of-concept.
-   `/contracts`: show real deployments and on-chain evidence only.
-   `/docs`: document trust assumptions, risk parameters, privacy scope,
    and testnet limitations.
-   `/vault`: may remain as a secondary/legacy technical demo; it must
    not compete with Lending as the primary product.
-   `/`: explain the unified product rather than presenting unrelated
    features.

Do not remove working routes or break existing tests without a clear
migration plan.

------------------------------------------------------------------------

# 3. Core Architecture and Trust Model

## 3.1 Target flow

``` text
Trusted issuer / official Dojang data
                 |
                 v
       Verify balance credential
                 |
                 v
       Bind data to a user/state
                 |
                 v
      Generate ZK eligibility proof
                 |
                 v
    On-chain proof/policy verification
                 |
                 v
        Eligibility authorization
                 |
                 v
       Lending & Borrowing engine
                 |
                 v
       Position monitoring / events
                 |
                 v
   Usage history may inform DAO Phase 2
```

## 3.2 Separate the three kinds of state

### A. Official Dojang state

Data read from official GIWA Dojang contracts and issued by an attester
explicitly trusted by the protocol. The app must show issuer identity,
schema, attestation UID, snapshot timestamp, validity/revocation state
when available, and the chain used for verification.

### B. Project-issued development credential

A controlled test credential issued by this project to exercise the ZK
circuit and contract path when official data is unavailable. It must be
labelled **Project Test Credential**. It must not be labelled official
Dojang, official Upbit verification, real exchange balance, or KYC.

### C. On-chain lending position

The user's actual supplied assets, debt, collateral, accrued interest,
and health/risk metrics stored or derived from lending contracts. This
is separate from an off-chain exchange balance credential.

Never treat A, B, and C as interchangeable.

## 3.3 Official Dojang/UPbit integration feasibility gate

The developer must verify, from the current official GIWA documentation
and contracts:

-   The current GIWA Sepolia chain ID and RPC configuration.
-   Official Dojang/EAS/DojangScroll addresses.
-   Official schema IDs and schema UIDs.
-   The relevant official attester ID/address.
-   Whether the intended user can actually obtain the required
    credential.
-   How a balance snapshot and user-specific balance proof are verified.
-   Whether balance data is publicly readable in the selected
    attestation schema.
-   Snapshot freshness, revocation, and issuer trust behavior.
-   Whether the integration supports the exact eligibility predicate the
    ZK circuit needs.

**Important:** official Dojang `Verified Balance` documentation includes
a `uint256 balance` field. Reading this attestation directly does not
automatically keep the balance private. Do not claim that the exact
balance remains hidden merely because the application uses ZK elsewhere.

If the official balance attestation exposes the exact value, investigate
the supported Balance Root/Merkle proof flow and whether a valid
witness/proof can be obtained and used in our circuit. Do not invent a
bridge between Dojang's Merkle proof and our ZK circuit. Document the
actual encoding, leaf construction, hash function, proof verification,
and issuer binding.

If the required official flow is not available to ordinary test users or
cannot be technically connected within the current environment: 1. Keep
the official integration visible as `Official Dojang status`. 2. Use a
separately labelled project-issued test credential only for testnet
development. 3. Mark official balance-to-ZK integration as blocked/not
yet implemented. 4. Do not imply Upbit has issued the test credential.
5. Report the exact blocker and recommended next step to the owner.

## 3.4 Upbit integration boundary

Official Dojang may use an Upbit Korea attester. That does not imply our
project has direct access to Upbit account APIs, can request credentials
for arbitrary users, or has permission to act on behalf of Upbit.

Direct Upbit API integration is optional future work and requires
separate analysis of authentication, user consent, API-key security,
data freshness, issuer trust, and attestation issuance. Never put an
Upbit secret/API key in frontend code.

An exchange balance may be used as an eligibility input only if its
provenance and binding are trustworthy. It is **not collateral** unless
the protocol has an enforceable mechanism to control or liquidate the
corresponding assets.

------------------------------------------------------------------------

# 4. Lending & Borrowing: Functional Requirements

## 4.1 Selected model

For Phase 1, implement a **shared liquidity pool lending model** with
asset-specific risk parameters. Keep the architecture modular enough to
add isolated markets later.

Do not attempt to implement every advanced DeFi feature at once.
However, the initial lending engine must include the fundamental
mechanisms needed for a real testnet lending loop.

## 4.2 Required core operations

### Supply

-   User supplies a supported ERC-20 asset into a lending reserve/pool.
-   Contract checks eligibility before accepting a new supply, according
    to the configured policy.
-   Supplied assets are accounted for accurately.
-   UI shows supplied amount, position value, estimated accrued
    interest, and withdrawal availability.
-   No fake APY or fabricated liquidity metrics.

### Withdraw supply

-   User withdraws supplied assets only if liquidity is available and
    the operation does not violate the protocol's rules.
-   Eligibility expiry must not arbitrarily trap the user's withdrawable
    supply.
-   If withdrawal is restricted because assets are borrowed or liquidity
    is unavailable, explain the actual reason.

### Enable/disable collateral

-   User can select supported assets as collateral if the architecture
    requires explicit enablement.
-   Contract verifies collateral eligibility and reserve configuration.
-   UI shows which supplied assets count as collateral.

### Borrow

-   User chooses a supported borrow asset and amount.
-   Preflight checks: wallet/network, eligibility authorization,
    available liquidity, collateral valuation, current debt, LTV, borrow
    cap, reserve status, and health factor after borrowing.
-   Contract independently enforces every critical condition. Frontend
    checks are not security controls.
-   Borrowing must revert if the position would exceed the configured
    borrowing limit or breach the required health factor.
-   Successful borrow transfers the asset to the user and updates debt
    accounting.

### Repay

-   User can repay part or all of the debt.
-   Repayment remains possible even if a Dojang credential expires, an
    issuer becomes unavailable, or the ZK service is temporarily down.
-   UI supports max/full repayment and accurately handles accrued
    interest and token decimals.
-   Successful repayment updates debt and emits an event.

### Liquidation

-   A liquidator can liquidate an unhealthy position according to
    explicit, tested rules.
-   The contract must calculate position health using configured oracle
    prices, collateral factors, liquidation threshold, and debt.
-   Liquidation incentive/bonus and close factor must be defined and
    bounded.
-   Liquidation must not rely on a frontend or admin manually declaring
    a position unhealthy.
-   UI shows liquidation status and explains that testnet liquidation is
    simulated with test assets.

### Interest accrual

-   Implement a documented interest-rate model based on utilization or
    another explicitly justified model.
-   State how interest is accrued and how supplier yield is calculated.
-   Handle rounding and token decimals consistently.
-   Do not display yield guarantees. Display rates as estimates that can
    change with utilization and parameter updates.

### Price oracle

-   Use a documented, testable oracle interface for supported assets.
-   For testnet, use a controlled test oracle only if clearly labelled;
    provide owner-controlled test price updates and bounds.
-   Never silently treat a fixed 1:1 price as a real market price.
-   Add stale-price checks, zero-price checks, and safe failure
    behavior.
-   Do not claim mainnet readiness based on a mock oracle.

### Risk controls

At minimum define and enforce: - Supported assets and reserve status. -
Supply caps and borrow caps. - Collateral factor / maximum LTV. -
Liquidation threshold. - Liquidation incentive. - Interest-rate
parameters. - Oracle staleness limits. - Minimum borrow amount, if
applicable. - Pause/emergency behavior and role permissions. -
Reentrancy protection and safe ERC-20 handling. - Debt rounding and dust
handling.

For testnet, parameters can be conservative and use test tokens, but the
code path must be real.

## 4.3 Eligibility enforcement policy

All new risk-increasing lending actions must require a valid
authorization derived from Dojang verification plus a ZK eligibility
proof.

Suggested classification:

  -----------------------------------------------------------------------
  Action                  Dojang/ZK eligibility   Reason
                          required?               
  ----------------------- ----------------------- -----------------------
  Start a new lending     Yes                     Entry to the protocol's
  session / enable                                protected financial
  borrowing                                       actions

  New supply              Yes, per owner          All lending
                          requirement             participation uses the
                                                  configured verification
                                                  flow

  Enable collateral       Yes                     Changes risk state

  New borrow              Yes                     Increases debt/risk

  Increase an existing    Yes                     Increases debt/risk
  borrow                                          

  Repay                   No additional           Users must be able to
                          eligibility should be   reduce debt safely
                          required                

  Withdraw excess         Apply risk checks; do   Safety and position
  collateral              not trap users solely   management
                          due to credential       
                          expiry                  

  Withdraw supply not     Apply                   User exit safety
  backing debt            liquidity/accounting    
                          rules; do not trap      
                          users solely due to     
                          issuer outage           

  Liquidate an unhealthy  Must not depend on the  Protocol solvency
  position                borrower's current      
                          credential              

  Read positions/markets  No                      Read-only access should
                                                  remain available
  -----------------------------------------------------------------------

If the owner explicitly requires a verification screen before every
action, the UI may continue to show verification status, but the smart
contract must not block repayment or essential risk-reducing operations
because a credential expired. Document this as a safety invariant.

## 4.4 Avoid fake "private lending"

The initial privacy guarantee is **private eligibility data**, not
complete transaction privacy.

Unless a separate privacy protocol is implemented, public chain
observers may still see: - Wallet addresses. - Transaction existence and
timing. - Supplied/borrowed/repaid token amounts. - Collateral and debt
positions, depending on contract/event design. - The fact that an
eligibility-gated action happened.

Do not claim private transfers, hidden debt, hidden positions, anonymous
wallets, or complete financial confidentiality.

------------------------------------------------------------------------

# 5. ZK Eligibility Specification

## 5.1 Intended proof

The ZK circuit should prove a statement such as:

> The user possesses a valid issuer-backed credential/commitment bound
> to the intended wallet and policy, and the private value satisfies the
> configured eligibility threshold.

The proof must not be based solely on a value typed by the user.

## 5.2 Required bindings

The proof/public inputs must be bound to the correct: - Wallet
address. - Credential commitment or verified state. - Issuer/attester or
issuer-authorized commitment. - Policy identifier and
threshold/version. - Chain ID. - Verifier/target contract or domain. -
Validity period or current credential status, where applicable. - Action
context if the proof is action-specific.

Use a domain-separated commitment construction and a high-entropy
secret/salt. Specify integer units and decimal conversion. Do not hash
ambiguous concatenations.

## 5.3 Replay protection

The implementation must prevent: - Using a proof for another wallet. -
Using a Vault proof in Lending or vice versa. - Reusing a proof against
a different policy or threshold. - Reusing a proof on a different chain
or contract. - Replaying an authorization when it is meant to be
one-time. - Using a revoked or expired credential where current validity
is required.

Decide explicitly whether the authorization is: - A reusable
time-limited eligibility authorization, or - A one-time/action-bound
proof.

For a lending UX, a time-limited authorization may reduce repeated
proof-generation friction, but it must have a clear expiry and
revocation model. The developer must document the tradeoff and test it.

## 5.4 Proof lifecycle states

UI and logs must distinguish: - `CREDENTIAL_NOT_FOUND` -
`CREDENTIAL_INVALID` - `CREDENTIAL_EXPIRED` - `CREDENTIAL_REVOKED` -
`ISSUER_UNAVAILABLE` - `WRONG_CHAIN` - `PROOF_NOT_GENERATED` -
`PROOF_GENERATED_LOCAL` - `PROOF_VERIFIED_LOCAL` - `TX_SUBMITTED` -
`PROOF_VERIFIED_ONCHAIN` - `ACTION_CONFIRMED` - `TX_REVERTED`

A local proof is not the same as an on-chain verified proof. A submitted
transaction is not a confirmed action.

------------------------------------------------------------------------

# 6. Lending Page UI/UX Specification

The `/lending` page should feel like a serious, modern DeFi application:
information-dense but easy to scan. Use a premium dark interface
consistent with the existing project identity. Avoid excessive glow,
fake activity, decorative charts with invented data, or a UI that hides
risk information.

## 6.1 Page structure

### A. Top navigation / context bar

Show: - Project logo/name. - Network badge: `GIWA Sepolia Testnet`. -
Connected wallet (short address). - Wallet/network status. -
Credential/eligibility status indicator. - Link to Dojang
verification. - Link to documentation and contracts.

If wrong network, show a clear switch-network action. Do not silently
change the user's network.

### B. Page header

Title: `Lending & Borrowing`

Short description:
`Supply assets, borrow against collateral, and manage your position with verified eligibility and privacy-preserving proofs.`

Display a persistent but unobtrusive `Testnet` badge.

Do not claim production security, guaranteed yield, official Upbit
endorsement, or full transaction privacy.

### C. Eligibility status card

This is a first-class component and should make Dojang/ZK visibly
meaningful.

Display separate rows: - Official Dojang status. - Balance credential
status. - Issuer name / attester. - Snapshot timestamp and freshness. -
Credential expiry/revocation state when available. - ZK proof status. -
Eligibility policy and threshold. - Last successful verification
transaction or proof reference, if available.

States: - `Verified` - `Action Required` - `Credential Not Found` -
`Expired` - `Revoked` - `Unable to Check` - `Demo Credential` (for
project-issued test credentials only) - `Proof Ready` -
`Proof Expired` - `Verifying`

Never show `Verified` when an RPC call failed. Never style a demo
credential to look indistinguishable from official Dojang/UPbit
attestation.

Primary action: - `Verify Balance` when credential is missing or
stale. - `Generate Private Proof` when credential is valid but proof is
missing/stale. - `View Verification Details` when the state is valid.

### D. Market overview metrics

Show real contract-derived metrics only: - Total supplied / total
liquidity. - Total borrowed. - Available liquidity. - Utilization. -
Supported assets count. - Current network. - Optional protocol
fee/interest information only if implemented.

If there is no real deployment or data, use an explicit empty state such
as `Market data will appear after the testnet contracts are deployed`.
Never fabricate TVL, volume, APY, or user counts.

### E. Main tabs

Use four clear tabs: 1. `Markets` 2. `Supply` 3. `Borrow` 4.
`Your Position`

A separate `Activity` panel or section can show protocol/user events.

#### Markets tab

For each supported asset show: - Token symbol and icon. - Supply APY
(computed from actual current model; label estimated/variable). - Borrow
APY (computed from actual current model). - Total supplied/liquidity. -
Total borrowed. - Utilization. - Collateral support. - Maximum LTV. -
Liquidation threshold. - Supply cap and borrow cap usage. - Oracle
status/last update. - `Supply` and `Borrow` entry actions, disabled with
a clear reason when unavailable.

Do not show APY if interest accrual is not implemented.

#### Supply tab

Fields and information: - Asset selector. - Wallet balance. - Amount
input with `MAX`. - Estimated share/receipt token amount if used by the
implementation. - Current supply APY, marked variable. - Estimated
accrued yield, only if calculable. - Available pool liquidity and supply
cap. - Eligibility status. - Transaction summary and token approval
state. - Exact allowance approval where appropriate; avoid unlimited
approval by default. - Review screen before wallet signature.

Action states: `Review Supply` → `Approve Token` if required →
`Confirm Supply` → transaction status → updated position.

If supply is blocked, explain whether the issue is eligibility, token
balance, allowance, cap, contract pause, or network.

#### Borrow tab

Fields and information: - Borrow asset selector. - Requested amount. -
Available liquidity. - Current debt. - Current collateral value. -
Current LTV. - LTV after the proposed borrow. - Health factor before and
after borrowing. - Maximum borrowable amount based on contract/oracle
state. - Borrow APY (variable). - Estimated interest/repayment
illustration, clearly labelled as estimate. - Borrow cap usage. - Oracle
freshness/status. - Eligibility/proof state. - Warning when the proposed
borrow approaches the risk boundary.

The app must compute a preview from current contract/oracle data, but
the contract must enforce the final decision. Never rely on the frontend
alone.

Action states: `Review Borrow` → transaction simulation/preflight →
wallet confirmation → submitted → confirmed/reverted → refresh position.

If a borrow is rejected, explain the actual reason: insufficient
collateral, low health factor, insufficient liquidity, cap reached,
stale oracle, missing eligibility, expired proof, or contract pause.

#### Your Position tab

Show: - Supplied assets. - Collateral-enabled assets. - Borrowed
assets. - Debt principal and accrued interest. - Total collateral
value. - Total debt value. - Current LTV. - Liquidation threshold. -
Health factor. - Distance to liquidation or approximate price-drop
buffer, if safely calculable. - Available withdraw amount. - Repay
amount and `Repay Max`. - Withdraw action and its restrictions. - Last
updated block/time. - Link to relevant on-chain transaction(s).

Use a clear risk visual, not a decorative gauge with no meaning: -
Healthy - Caution - Near liquidation - Liquidatable

Thresholds must come from protocol configuration, not arbitrary frontend
constants.

Provide `Repay` and safe position-management actions even if the user's
credential has expired or the issuer is offline, subject to actual
contract rules.

#### Activity section

Show event-derived history: - Supply. - Withdraw. - Collateral
enable/disable. - Borrow. - Repay. - Liquidation. - Eligibility
authorization/expiry, if emitted and safe to display.

For each event: - Action. - Asset and amount. - Timestamp/block. -
Transaction hash. - Status. - Explorer link.

Do not rely on a client-side list as the authoritative source for
transactions.

### F. Transaction feedback

Use a consistent lifecycle: 1. Preflight/simulation. 2. Wallet
confirmation required. 3. Submitted. 4. Included/confirmed. 5.
Finalized, if the chain/explorer supports reliable finality data. 6.
Reverted/rejected.

Never show success merely because the user clicked a button or generated
a proof.

### G. Privacy explanation

Add a small `What stays private?` expandable panel: - Explain the
specific witness/value hidden by the ZK proof. - Explain which public
inputs are revealed. - Explain that wallet address, transaction timing,
token transfers, and lending positions may remain public. - Link to
technical documentation. - Do not claim complete privacy or native
Bojagi private transfers.

### H. Responsive and accessibility requirements

-   Desktop: dense dashboard layout with readable columns and risk
    sidebar.
-   Tablet/mobile: stack cards and convert tables into
    scrollable/stacked views.
-   All forms have labels, validation, and understandable error
    messages.
-   Support keyboard navigation and visible focus states.
-   Do not encode statuses only by color.
-   Handle loading, empty, error, wrong-chain, disconnected, and
    unavailable states.
-   Avoid layout shifts when wallet/chain data loads.

------------------------------------------------------------------------

# 7. Dojang Page UI/UX Specification

The `/dojang` page should explain and show the credential source.

Show: - Connected wallet. - GIWA Sepolia network state. - Official
Dojang status as read from official contracts. - Issuer/attester. -
Schema. - Attestation UID. - Timestamp/snapshot age. - Expiry/revocation
status when available. - Exact meaning and limitations of the
credential. - A link to official GIWA documentation/explorer evidence. -
The separate project test credential state, if used.

Never merge `Official Dojang Credential` and `Project Test Credential`.

For balance: - Show whether the official source supports the requested
balance data. - Show snapshot time and source. - Explain if the balance
is public in the attestation. - If a Merkle proof is required, show the
verification status without leaking private witness data. - If the
required official credential cannot be obtained, say so clearly and
offer the explicitly labelled test-only route.

Suggested states: - `Official credential found` -
`No official credential found` - `Credential expired/revoked` -
`Could not check the network` -
`Balance credential unsupported/unavailable` -
`Project test credential available`

------------------------------------------------------------------------

# 8. DAO Phase 1 --- Small but Real Proof of Concept

DAO Phase 1 must be implemented now, but it must not delay the core
Lending & Borrowing path.

## 8.1 Purpose

Demonstrate a real governance workflow with verified membership. Do not
claim the DAO is fully private or a mature governance system.

## 8.2 Membership

-   Use the official Dojang Verified Address credential if available.
-   Contract must enforce membership for proposal/voting writes, not
    just the frontend.
-   If official credentials are unavailable to test users, use a clearly
    labelled local/test path for demonstration and document that it is
    not official membership.
-   Do not use a project-issued lending demo credential as if it were
    official Dojang membership.

## 8.3 Minimum DAO functions

-   List proposals.
-   Show proposal detail, status, start/end time, and voting results.
-   Create a proposal (member-gated).
-   Vote (member-gated).
-   Finalize a proposal after the voting window.
-   Execute or mark execution according to a clearly defined, tested
    model.
-   Show on-chain transaction links and event-derived results.
-   Prevent duplicate votes per wallet per proposal.
-   Validate proposal timing and state transitions in the contract.
-   Document voting power: one-wallet-one-vote for Phase 1 unless an
    existing tested design already defines another simple model.
-   Clearly state that one wallet does not equal one human and that
    Phase 1 votes are public.

Do not add a treasury, tokenomics, complex delegation, quadratic voting,
or privacy voting unless the basic lifecycle is complete and tested.

## 8.4 DAO Phase 1 UI

-   Membership status card: official/test credential clearly
    distinguished.
-   Proposal list with `Active`, `Pending`, `Passed`, `Rejected`,
    `Executed`, `Expired` states as supported.
-   Proposal detail and voting panel.
-   Vote transaction state and explorer evidence.
-   A clear `Phase 1 testnet governance` label.
-   Explain privacy boundary: membership verification may be
    credential-based, but ordinary on-chain votes are publicly
    attributable to wallet addresses.

------------------------------------------------------------------------

# 9. DAO Phase 2 --- Roadmap (Required, Deferred Until Phase 1 Completion)

**DAO Phase 2 must not be started until all of the following are
completed and reported to the owner:** 1. Lending & Borrowing core
acceptance criteria pass. 2. Official Dojang integration status and any
blockers are documented. 3. ZK eligibility is verified on-chain for the
intended lending action. 4. Lending end-to-end tests pass on GIWA
Sepolia. 5. DAO Phase 1 proposal/voting lifecycle is deployed and
tested. 6. Deployment evidence and known limitations are reported. 7.
The owner has been explicitly informed that Phase 1 is complete.

After the report, the owner can approve starting DAO Phase 2. Do not
silently continue into Phase 2.

## 9.1 Phase 2 goal

Evolve the simple governance demo into a more meaningful, private,
reputation-aware governance system for active users of the lending
protocol.

Potential positioning: **Private Lending Council / Dark DAO**, but the
term "fully private" must only be used if membership, voting, and
relevant metadata privacy have actually been implemented and verified.

## 9.2 Phase 2 work packages

### Work package A --- Membership policy design

-   Define the purpose and powers of the council.
-   Define who qualifies: verified credential, qualifying protocol
    usage, duration, contribution, and/or repayment behavior.
-   Do not use transaction volume alone as a proxy for reputation.
-   Prevent obvious wash-volume or repeated-transfer gaming where
    feasible.
-   Define whether membership expires and how renewal works.
-   Define whether membership is transferable (default should be
    non-transferable unless there is a strong reason otherwise).
-   Define appeal/revocation process and issuer responsibilities.

### Work package B --- Verifiable lending reputation

-   Derive activity from canonical lending contract events/state, not
    user-submitted screenshots.
-   Define metrics such as time using the protocol, supply/borrow
    participation, repayment history, liquidation history, and ecosystem
    contribution.
-   Separate facts from scoring assumptions.
-   Avoid exposing more user financial history than necessary.
-   Specify how a reputation claim is issued, updated, expires, and is
    revoked.
-   Consider Sybil resistance; a wallet is not automatically a unique
    human.
-   Do not automatically equate high debt or large transaction size with
    good reputation.

### Work package C --- Private membership credential

-   Define an issuer-backed membership credential or commitment.
-   Bind the credential to the intended wallet/secret and membership
    policy.
-   Define what is public and what is hidden.
-   Use ZK proofs to prove membership/eligibility without disclosing
    unnecessary underlying metrics.
-   Ensure credential expiry/revocation is handled.
-   Avoid using a central backend as an invisible witness custodian; if
    a backend is required, disclose the privacy trade-off and threat
    model.

### Work package D --- Private voting architecture

Evaluate viable approaches before coding, including: -
Anonymous/commitment-based voting. - ZK eligibility proof plus vote
commitment. - Commit-reveal voting and its UX/metadata limitations. -
Nullifier-based prevention of duplicate votes where applicable. - Vote
tallying and proof of correct tally. - Governance proposal binding and
replay protection. - Whether the chosen scheme hides voter identity,
vote choice, or both.

Do not call a system private merely because vote contents are not shown
in the UI. Analyze public calldata, logs, wallet metadata, timing, and
transaction graph.

### Work package E --- Governance quality and safeguards

-   Define proposal types and allowed powers.
-   Add quorum and pass thresholds.
-   Add proposal lifecycle and cancellation rules.
-   Add timelock for high-impact execution where appropriate.
-   Add emergency/guardian powers only with clearly scoped permissions
    and transparency.
-   Prevent a governance proposal from changing core lending risk
    parameters without the required review/security process.
-   Define upgradeability and key-management model, if any.
-   Add tests for malicious/invalid proposals, replay, double voting,
    expired membership, revoked credentials, and invalid proofs.

### Work package F --- UX and transparency

-   Private membership onboarding.
-   Membership credential status and expiry.
-   Proof generation and verification status.
-   Proposal list/detail.
-   Private voting flow and confirmation.
-   Tally verification.
-   Clear explanation of what is and is not private.
-   Public contract addresses and verifiable evidence.
-   Accessible recovery path if proof generation fails.

### Work package G --- Security review

-   Threat model.
-   Circuit review.
-   Smart contract review.
-   Reentrancy/authorization/replay tests.
-   Privacy leakage analysis.
-   Gas/performance analysis.
-   Independent review before any real-value deployment.
-   Document limitations and emergency response.

## 9.3 Phase 2 acceptance criteria

Phase 2 is complete only when: - Membership rules are explicit and
enforceable. - Reputation inputs are reproducible and not solely
frontend-supplied. - Private eligibility proof is bound to a valid
membership credential. - Duplicate voting is prevented. - The privacy
guarantee is defined precisely and tested against public
calldata/events. - Voting tally and proposal state can be independently
verified. - Expiry/revocation behavior is tested. - Security review
findings are documented and resolved or explicitly accepted. - The owner
receives a report with deployment/test evidence and remaining
limitations.

------------------------------------------------------------------------

# 10. Roadmap Beyond the Initial Lending Upgrade

Only add roadmap items after core requirements are working. Suggested
order:

## Phase 1 --- Functional testnet product (current priority)

1.  Audit current repository and preserve reusable work.
2.  Verify official Dojang integration and balance-data feasibility.
3.  Implement real shared-pool lending mechanics.
4.  Integrate Dojang verification and ZK eligibility into
    risk-increasing actions.
5.  Implement safe repay/withdraw/position-management paths.
6.  Implement DAO Phase 1.
7.  Deploy project contracts to GIWA Sepolia.
8.  Run end-to-end tests with funded test wallets.
9.  Update `/contracts` and `/docs` with verifiable evidence.
10. Report Phase 1 completion to the owner.

## Phase 1.5 --- Hardening after owner review

-   Fix issues discovered during testnet usage.
-   Improve oracle and risk controls.
-   Add better monitoring and transaction diagnostics.
-   Improve mobile/responsive UX.
-   Review gas costs and proof-generation latency.
-   Improve credential refresh/revocation handling.
-   Add additional supported test assets only when risk configuration is
    tested.

## Phase 2 --- Private Lending Council / Dark DAO

Start only after the owner receives the Phase 1 completion report and
approves proceeding. Execute the work packages defined in Section 9.

## Phase 3 --- Advanced lending markets

Potential upgrades: - Isolated lending markets. - Curated risk
vaults/market configurations. - More sophisticated utilization-based
interest-rate curves. - Additional oracle integrations. - Better risk
analytics and position health notifications. - Additional assets and
collateral types. - More robust reserve accounting and liquidation
incentives. - Optional market-specific eligibility policies. - Formal
verification and independent audits as appropriate.

## Phase 4 --- Advanced privacy and integrations

Potential upgrades, each requiring a separate technical design: -
Stronger private financial-state proofs using compatible issuer/Merkle
commitments. - Official balance credential renewal and proof pipeline,
if supported by GIWA/issuer. - Direct Upbit API integration only if
there is a clear product need and safe, authorized design. - More
advanced ZK policy types. - Private governance/voting. - Optional
integration with additional trusted issuers. - SDK for other protocols
to consume verified eligibility.

These are roadmap possibilities, not promises of current functionality.

------------------------------------------------------------------------

# 11. Required Testing

## 11.1 Smart contract unit tests

At minimum: - Supply and withdraw accounting. - Borrow within limit. -
Borrow above limit reverts. - Insufficient liquidity reverts. - Repay
partial and full. - Interest accrual and rounding. - Oracle
stale/zero/invalid values. - Health factor/LTV calculation. -
Liquidation eligibility and payout. - Supply/borrow cap enforcement. -
Unauthorized role access. - Reentrancy protection. - Credential
missing/invalid/expired/revoked. - Invalid ZK proof rejected. - Wrong
wallet/policy/chain/contract proof rejected. - Proof replay rejected
where applicable. - Repay and safety operations still work if
eligibility expires. - DAO member-only proposal/vote. - Duplicate vote
rejected. - Invalid proposal lifecycle transitions rejected.

## 11.2 Circuit and cross-layer tests

-   Circuit compiles reproducibly.
-   Proof is generated from the correct witness.
-   Valid witness succeeds.
-   Incorrect threshold fails.
-   Wrong wallet fails.
-   Wrong commitment fails.
-   Wrong policy fails.
-   Wrong chain/domain fails.
-   Public-input order matches Solidity verifier exactly.
-   No exact private value is included in public calldata/events unless
    explicitly intended and documented.
-   Revoked/expired credential is rejected by the configured enforcement
    path.

## 11.3 Frontend tests

-   Disconnected wallet.
-   Wrong network.
-   RPC unavailable.
-   Official credential absent.
-   Official credential present.
-   Test credential present.
-   Stale/expired/revoked credential.
-   Proof generation failure.
-   Wallet rejection.
-   Transaction pending/confirmed/reverted.
-   Empty market state.
-   Stale oracle state.
-   Borrow exceeds available amount.
-   Position near liquidation.
-   Repay when eligibility expires.
-   Mobile layout and keyboard navigation.

## 11.4 End-to-end testnet acceptance

The project must demonstrate, using actual deployed contracts and real
wallet-signed transactions: 1. Read official Dojang status where
available. 2. Show a clear official-credential-unavailable state where
not available. 3. Obtain a project test credential only via an
explicitly labelled development issuer if required. 4. Generate a real
ZK proof. 5. Verify that proof on-chain. 6. Supply test assets. 7.
Enable collateral. 8. Borrow within limits. 9. Reject borrow beyond
limits. 10. Repay partially and fully. 11. Withdraw when allowed. 12.
Trigger a controlled test liquidation scenario if supported. 13. Create
and vote on a DAO Phase 1 proposal. 14. Confirm transaction hashes and
explorer links. 15. Verify contract state after transactions rather than
trusting frontend messages.

A local test pass is useful but does not satisfy testnet deployment
acceptance.

------------------------------------------------------------------------

# 12. Definition of Done --- Lending & Borrowing

Lending is **not complete** merely because the page looks finished or a
ZK proof can be generated.

Lending Phase 1 is complete only when all relevant items below are
satisfied:

-   [ ] Supported assets and risk parameters are documented.
-   [ ] Supply works on deployed GIWA Sepolia contracts.
-   [ ] Withdraw works and respects pool liquidity/risk constraints.
-   [ ] Collateral accounting works.
-   [ ] Borrow transfers assets and updates debt correctly.
-   [ ] Repay partial/full works and updates debt correctly.
-   [ ] Interest accrues according to the documented model.
-   [ ] Oracle data is consumed by contracts and stale/invalid data
    fails safely.
-   [ ] LTV/health checks are enforced on-chain.
-   [ ] Liquidation path is implemented and tested, or a documented,
    owner-approved limitation exists for a constrained prototype.
-   [ ] Dojang status is read from official contracts when available.
-   [ ] Balance eligibility uses a trustworthy source and has a
    documented snapshot/expiry model.
-   [ ] ZK proof is generated from issuer-backed state, not arbitrary
    user-entered values.
-   [ ] Proof is verified on-chain and bound to wallet/policy/domain.
-   [ ] Invalid, expired, revoked, wrong-wallet, and replayed proofs are
    rejected as designed.
-   [ ] Credential expiry/RPC outage cannot trap users' existing funds
    or prevent repayment.
-   [ ] Lending UI displays real on-chain state and clear error states.
-   [ ] Testnet transactions have hashes and explorer evidence.
-   [ ] No fabricated TVL, APY, credential, or transaction success is
    displayed.
-   [ ] Documentation states what is private and what remains public.
-   [ ] Tests/build/typecheck pass and results are reported.

If an item cannot be completed because official issuer access or a
technical dependency is unavailable, mark it as **BLOCKED** with
evidence and owner-facing options. Do not quietly mark it complete.

------------------------------------------------------------------------

# 13. Definition of Done --- DAO Phase 1

-   [ ] Membership verification path is implemented and its
    official/test status is clear.
-   [ ] Proposal creation is contract-enforced.
-   [ ] Voting is contract-enforced.
-   [ ] Duplicate voting is prevented.
-   [ ] Proposal lifecycle is tested.
-   [ ] Finalization/execution behavior is explicit.
-   [ ] UI shows real proposal and vote state.
-   [ ] Transaction evidence is available.
-   [ ] Public-voting limitation is clearly documented.
-   [ ] Tests pass.
-   [ ] The owner receives the completion report before DAO Phase 2
    begins.

------------------------------------------------------------------------

# 14. Required Final Report to the Owner

When Lending & Borrowing and DAO Phase 1 are complete, send a report to
the owner before starting DAO Phase 2.

The report must include:

1.  Summary of what is actually implemented.
2.  What is deployed versus local-only.
3.  GIWA Sepolia chain and RPC used.
4.  Official Dojang schemas/attesters/contracts used.
5.  Whether official balance credential integration works for real
    eligible test users.
6.  Any use of project-issued test credentials and exact limitations.
7.  ZK circuit/verifier design and privacy boundaries.
8.  Lending functions demonstrated: supply, withdraw, collateral,
    borrow, repay, interest, oracle, liquidation.
9.  DAO Phase 1 functions demonstrated.
10. Contract addresses and verified-source links.
11. Transaction hashes and explorer links.
12. Test commands and pass/fail results.
13. Known limitations, security risks, and blocked items.
14. Confirmation that DAO Phase 2 has **not** started.
15. Recommended next actions for owner approval.

The report must clearly separate: - Implemented and tested locally. -
Deployed and verified on-chain. - Demonstrated in an end-to-end test. -
Not implemented or blocked.

------------------------------------------------------------------------

# 15. Branding and Claims

## Allowed when technically accurate

-   `Built on GIWA Sepolia`
-   `Integrates official GIWA Dojang verification` --- only after actual
    integration is demonstrated.
-   `Bojagi-inspired ZK eligibility` --- if our own ZK eligibility
    circuit is used.
-   `Privacy-preserving eligibility` --- with the exact guarantee
    explained.
-   `Demonstrating how verifiable off-chain data can support DeFi lending`.

## Not allowed without evidence/authorization

-   `Official GIWA partner`
-   `Official Upbit integration` when only a demo issuer is used.
-   `Upbit verified` for a project-issued credential.
-   `Native Bojagi implementation` when using our own circuit.
-   `Fully private lending` when addresses, transactions, balances, or
    positions remain public.
-   `Audited` or `production-ready` without the relevant independent
    review.
-   Claims that an exchange balance is collateral when the protocol
    cannot enforce against that asset.

The marketing goal is to demonstrate that GIWA's verification concepts
can power a practical DeFi application. The most credible way to get
noticed is to show real integrations, verifiable transactions, clear
technical evidence, and accurate claims.

------------------------------------------------------------------------

# 16. Official References

-   Project repository: https://github.com/dojangbojagi/dojang
-   Existing master brief:
    https://github.com/dojangbojagi/dojang/blob/main/docs/GIWA_Private_Verifiable_State_Master_Development_Brief.md
-   Existing frontend integration map:
    https://github.com/dojangbojagi/dojang/blob/main/docs/FRONTEND_FINAL_INTEGRATION_MAP.md
-   GIWA website: https://giwa.io/home
-   Official GIWA Dojang documentation:
    https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang
-   Official Dojang contract references:
    https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts
-   Official Dojang repository: https://github.com/giwa-io/dojang
-   Aave V3 documentation: https://www.aave.com/docs/aave-v3/overview
-   Euler documentation: https://docs.euler.finance/introduction/

Always re-check current addresses, schemas, and deployment status before
implementation; external contract details may change.

------------------------------------------------------------------------

## Final instruction

The highest priority is a **working Lending & Borrowing protocol that
genuinely uses Dojang verification and an on-chain-verified ZK
eligibility layer**. Build the real contract path first, connect the UI
to real states, and prove it with GIWA Sepolia transactions.

DAO Phase 1 must be completed as a small real governance demonstration.
DAO Phase 2 is a required, detailed roadmap item, but must only begin
after Lending & Borrowing and DAO Phase 1 are complete, tested,
documented, and reported to the owner.
