# Dojang-to-Lending Feasibility — Stage A

**Assessment date:** 2026-10-11

**Official integration classification:** **BLOCKED** for a privacy-preserving, user-ready lending path. The published on-chain Merkle verification mechanism is real and a ZK membership proof is technically plausible, but the project has no circuit integration and no confirmed private witness issuance/delivery path.
**Implementation scope:** read-only source/network review and documentation only. No contract, circuit, service, hook, frontend, deployment, or transaction changes were made.

## 1. Owner brief availability and comparison

The requested target file `docs/DOJANG_BOJAGI_LENDING_UPGRADE_DEV_BRIEF.md` is absent from the workspace, including an ignored-file search. Therefore, I could not read or reconcile the owner's full brief line by line. I compared the requirements in the current request with [`LENDING_UPGRADE_GAP_ANALYSIS.md`](LENDING_UPGRADE_GAP_ANALYSIS.md), [`DEPLOYMENT_READINESS.md`](DEPLOYMENT_READINESS.md), and the source code.

The current request does not overturn the previous core findings. It adds two concrete findings:

1. Official DojangScroll already exposes Balance Root and Verified Balance reads, and the official resolver checks a Merkle inclusion proof. The local app ABI/interface does not expose these methods.
2. The official mechanism does not currently provide a demonstrated privacy-preserving witness path to this project. The user-level Verified Balance attestation stores the amount and proof data on-chain in clear ABI-encoded form.

The prior gap analysis's **BLOCKED** status remains correct for the project's intended private integration, even though the external protocol's schemas and resolver are deployed.

## 2. Confirmed GIWA Sepolia state

At the latest read available during this assessment, the public GIWA RPC returned chain ID `91342`. Read-only calls confirmed runtime code at all of these documented external contracts:

| Contract | GIWA Sepolia address | Read result |
|---|---|---|
| DojangScroll | `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` | Code present |
| DojangAttesterBook | `0xDA282E89244424E297Ce8e78089B54D043FB28B6` | Code present |
| EAS | `0x4200000000000000000000000000000000000021` | Code present |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` | Code present |
| BalanceRootDojangResolver | `0xD90a964aB65bc02397De1E7fcBd230803bC1bEd0` | Code present |
| BalanceDojangResolver | `0x6FFa7ABc1E380Bb967C78D5E648EF804e1fE6dAd` | Code present |

`DojangAttesterBook.getAttester(UPBIT_KOREA_ATTESTER_ID)` returned `0x09B170CA2A006081042992bCE7379B85a02149C6`.

Direct reads from the published SchemaRegistry address returned:

| Schema | UID | Schema string | Resolver | Revocable |
|---|---|---|---|---|
| Balance Root | `0x369faa9c2cd261c45be3db5e230b585f5f1abecf8e12be575bb543e917e6db52` | `uint256 coinType,uint64 snapshotAt,uint192 leafCount,uint256 totalAmount,bytes32 root` | `0xD90a964aB65bc02397De1E7fcBd230803bC1bEd0` | `true` |
| Verified Balance | `0x77bf88ca262cc63e1b185dccd870aacc5320b8987ef6c7169920f265fe6ab5e9` | `uint256 balance,bytes32 salt,bytes32[] proofs` | `0x6FFa7ABc1E380Bb967C78D5E648EF804e1fE6dAd` | `true` |

These are current read-only chain observations, not evidence of a specific user's credential, a root's current validity, or project deployment. No wallet address or attestation UID for a balance-verified test user was supplied. I did not scan the full EAS history or infer that no balance roots exist.

The current English [GIWA Dojang contracts page](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts) lists the same Upbit address as the direct read. [`DEPLOYMENT_READINESS.md`](DEPLOYMENT_READINESS.md) contains an older comparison against `0x4097…`; that mismatch statement is stale relative to the current page and direct observation. An older indexed documentation result still showed the former address, so runtime `DojangAttesterBook.getAttester` must remain authoritative.

## 3. Official issuance, lookup, and Merkle proof path

GIWA identifies **UPbit Korea** as the Dojang issuer and directs prospective Dojang service issuers to contact GIWA. The contract table separately lists a **TESTNET FAUCET** attester. A faucet attestation is not an Upbit Korea balance credential and must not be substituted for one. The [Dojang overview](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang) describes Balance Root and Verified Balance, but the reviewed public materials do not provide a general test-user API or instructions for privately downloading a user's balance, salt, and Merkle path.

Official DojangScroll source has these relevant read methods:

- `getBalanceRootAttestationUid(uint256 coinType, uint64 snapshotAt, bytes32 attesterId)` finds the root through the AttestationIndexer using the selected schema, the address currently mapped to `attesterId`, recipient `address(0)`, and a key derived from `(coinType, snapshotAt)`. It checks that the found attestation is present and not expired/revoked.
- `getVerifiedBalanceAttestationUid(address recipient, uint256 coinType, uint64 snapshotAt, bytes32 attesterId)` finds the matching user balance attestation and checks that the attestation is present and not expired/revoked.
- `getVerifiedBalance(address recipient, uint256 coinType, uint64 snapshotAt, bytes32 attesterId)` validates the balance attestation's reference to a root, the root schema and zero recipient, the root's current trusted attester, the decoded coin type/snapshot and the user recipient, then returns the raw `uint256 balance`.

The [official DojangScroll source](https://github.com/giwa-io/dojang/blob/main/src/DojangScroll.sol) uses the AttestationIndexer rather than requiring consumers to scan all EAS events. The [Balance Root resolver](https://github.com/giwa-io/dojang/blob/main/src/abstract/BalanceRootValidationResolverUpgradeable.sol) checks a valid coin type, `snapshotAt <= block.timestamp`, nonzero leaf count, total amount, and root. It does not impose a maximum snapshot age. The lending contract would need to enforce a chosen freshness bound.

When a Verified Balance attestation is issued, the [Balance resolver](https://github.com/giwa-io/dojang/blob/main/src/abstract/BalanceValidationResolverUpgradeable.sol) loads the referenced root and decodes `(amount, salt, proofs)`. It computes:

```text
leaf = keccak256(bytes.concat(keccak256(abi.encode(recipient, amount, salt))))
```

and checks the proof path against the root using OpenZeppelin `MerkleProof.verify` (sorted-pair Merkle hashing). This is a real issuer-attestation-time membership check. The resolver source does not expose a private user witness service. The Verified Balance attestation's public EAS `data` contains the amount, salt, and proof array, so anyone able to read that attestation can recover them. The schema's existence therefore does not mean the per-user balance is private.

Both schemas were confirmed revocable on the live SchemaRegistry. The Dojang sources check EAS revocation/expiration state when resolving an attestation; the root resolver's `onRevoke` callback itself does not maintain a separate project-level revocation list. Any project borrower flow must recheck the root's EAS validity at the time it accepts a proof. It must not permanently trust a root merely because its proof verified earlier.

### User credential and witness availability

**Not confirmed.** No eligible test-user wallet, official Verified Balance UID, current Balance Root UID, or private witness was supplied or positively read. Public material names UPbit Korea as issuer and provides an issuer contact route, but it does not establish that arbitrary GIWA Sepolia test users can receive a Verified Balance attestation or obtain `(balance, salt, path)` privately. The documented GIWA Wallet “Onchain Verify” flow is not evidence of a Balance Root witness channel.

If a user already has an on-chain Verified Balance attestation, its raw witness fields are public and could technically be copied into a local proof generator, but that cannot meet a requirement to keep the private balance secret. A private proof path requires the trusted issuer to provide the witness privately from the Balance Root dataset without first publishing the user's clear balance in a Verified Balance attestation, or an owner-approved alternative credential design. No such capability was confirmed.

## 4. Existing project integration and circuit reuse

The current repository implements only these Dojang pieces:

- [`src/hooks/use-dojang-verification.ts`](../src/hooks/use-dojang-verification.ts) reads Verified Address status, UID, attester mapping, and EAS metadata.
- [`src/lib/contracts/abis.ts`](../src/lib/contracts/abis.ts) includes DojangScroll `isVerified` and `getVerifiedAddressAttestationUid`; it does not include the three balance functions above.
- [`contracts/src/interfaces/IDojangVerification.sol`](../contracts/src/interfaces/IDojangVerification.sol) contains only Verified Address calls, `getAttester`, and generic EAS attestation reads.
- [`contracts/src/config/GIWASepoliaDojang.sol`](../contracts/src/config/GIWASepoliaDojang.sol) contains the official Scroll, AttesterBook, EAS, Upbit attester ID, and Verified Address schema UID, but no balance schema UIDs.
- [`contracts/src/LendingPool.sol`](../contracts/src/LendingPool.sol) does not call Dojang. Its `borrow` is gated by project policy-2 `DemoCredentialRegistry` state and the project eligibility verifier. It binds the proof to the borrower, policy, expiry, chain, and LendingPool.
- [`circuits/private_eligibility/src/main.nr`](../circuits/private_eligibility/src/main.nr) has nine public fields (`subject`, Pedersen `commitment`, policy/version, threshold, credential version, expiry, chain ID, pool address) and private `u64 private_value` plus Pedersen salt. It does not accept a Dojang root or Merkle path.
- [`contracts/src/EligibilityVerifierAdapter.sol`](../contracts/src/EligibilityVerifierAdapter.sol) and the generated verifier are built for the existing nine public inputs.

**The existing circuit cannot be reused as-is.** The browser proving pipeline and verifier integration patterns can be reused, but the relation itself must change or be versioned. A Dojang-backed circuit would need to privately prove all of the following together:

1. The caller's `recipient` and private `balance`/`salt`/Merkle siblings form the official nested-Keccak leaf.
2. The leaf verifies against the public root that the lending contract has authenticated from the official root attestation.
3. The private balance meets the approved minimum, without publishing the amount as a public input.
4. The proof is bound to the subject, coin type, snapshot, root UID/root, policy/version, GIWA chain ID, and exact LendingPool.

The circuit needs an explicit maximum Merkle depth and leaf-count policy; the schema's `uint192 leafCount` does not define a practical circuit path bound. Noir must reproduce Ethereum Keccak-256 encoding and sorted-pair semantics byte-for-byte. There is no repo proof fixture for this relation, no prover-time benchmark, and no gas/verification benchmark. These must be established before calling the cryptographic path complete.

## 5. Can Dojang plus ZK gate borrowing safely?

**Conditionally, if an approved private witness channel is established.** A future risk-increasing `borrow` operation could require all of these checks atomically:

1. Require `msg.sender` equal the proof subject.
2. If the owner policy requires both claims, call `DojangScroll.isVerified(subject, UPBIT_KOREA_ATTESTER_ID)` for official Verified Address separately. Verified Balance by itself is not a substitute unless the owner explicitly accepts it.
3. Resolve the current trusted attester from `DojangAttesterBook.getAttester(attesterId)`. Do not hardcode the changing attester address or accept an arbitrary caller-provided attester.
4. Check the root EAS attestation UID, nonzero UID, exact Balance Root schema, `recipient == address(0)`, current mapped trusted attester, nonrevoked/nonexpired status, matching coin type/snapshot/root fields, and an owner-approved maximum snapshot age.
5. Verify the proof against the root and the approved policy, with chain, pool, subject, root UID/root, coin type, snapshot, and threshold bound consistently between circuit and Solidity.
6. Apply this eligibility gate only to new/risk-increasing borrow actions.

Repayment must remain available without Dojang, proof, issuer, or oracle availability. Liquidation must be permissionless and must not depend on a current borrower credential or ZK witness; it depends on independently valid risk data and contract rules. Supplier withdrawal should depend on actual available liquidity and supplier entitlement, not Dojang. Collateral withdrawal should not require a fresh identity proof, but with debt outstanding must pass fresh health/risk checks; if price data is unavailable, allow safe debt-free withdrawal and continue to permit repayment and collateral addition. These conditions must be covered by tests.

If the official root is revoked or expires after a loan is opened, it must block new borrowing but must not erase debt, prevent repayment, or prevent liquidation. Root age, the coin type, whether one or both attestation types are required, and policy thresholds remain product/security decisions that the missing owner brief must settle.

## 6. Exact Stage B change map (planning only)

This is a file/interface plan, not authorization to implement Stage B. Financial engine mechanics also require owner-approved rates, oracle, caps, liquidation, and reserve-loss policies as described in the gap analysis.

| Layer | Expected changes after Stage A approval |
|---|---|
| Solidity | Preserve `LendingPool.sol` as the demo reference or implement a separately tested `LendingPoolV2.sol`; do not mutate already-deployed immutable contracts. Add a balance-root verification interface/adapter using `DojangScroll`, `DojangAttesterBook`, and EAS. Use the dynamic attester-book mapping, exact schema, root UID, EAS validity, and explicit snapshot freshness. Make the borrow verifier consume an updated proof/public-input format. Keep repay, risk-reducing collateral addition, and liquidation independent of eligibility. |
| ZK circuit/verifier | Version or add a circuit under `circuits/` for private amount/salt/path, nested Keccak leaf, sorted Merkle path, minimum balance, and domain-bound public inputs. Fix a maximum depth and canonical encoding. Regenerate the Honk verifier, update/create its adapter for the new public-input arity, and keep the current policy-1 Vault and policy-2 demo circuit path working unless an owner-approved migration replaces it. |
| Dojang config/deployment | Add the official Balance Root and Verified Balance schema UIDs to `contracts/src/config/GIWASepoliaDojang.sol` and `src/lib/config/contracts.ts` only after verifying them on the target chain. Keep Scroll/EAS/AttesterBook as external config. Extend `contracts/script/DeployLendingGIWASepolia.s.sol` or add a versioned deployment script with the approved Dojang verification adapter, new verifier, chosen oracle/rate model, test assets, and risk parameters. Keep public addresses/parameters separate from protected signer material. Simulate only until separately authorized. |
| ABIs and services | Extend `src/lib/contracts/abis.ts` with the DojangScroll balance getters and root metadata calls, plus V2 methods/events. Add a read-only `src/lib/protocol/dojang-balance.ts`-style service that verifies schema/UID/attester/expiry/revocation/root fields and returns explicit unavailable/error states. Avoid calling `getVerifiedBalance()` for a privacy-preserving UI path because it returns the clear balance. Use bounded event scans or the official indexer with an explicit `(coinType,snapshotAt)`; do not scan unbounded history to guess the latest root. |
| Hooks and shared types | Add a separate official Dojang balance status/witness hook rather than merging it with project demo credentials. Version `useLendingEligibilityProof` to accept the official private witness and root context only after the issuer path exists. Update `useLendingMarket.borrow` and protocol proof types to carry the new proof/root binding and V2 transaction lifecycle. Preserve the current `useLendingCredential` as a clearly labeled project-demo path until it is deliberately retired. |
| Regression tests | Add root/schema/attester integration fixtures and tests for valid inclusion, invalid path, wrong recipient/coin/snapshot/policy/root, attester rotation, revoked/expired/stale root, threshold boundaries, proof replay across users/roots/chains/pools, and no raw balance in proof public inputs/events. Re-run current 60-test suite to preserve DAO Phase 1, Vault, and existing demo behavior. Local fixtures must be labeled synthetic and must not be reported as official credentials. |

### Development credential fallback

If official balance issuance/private witnesses remain unavailable, use the existing project-issued policy-2 demo credential only for local development or a clearly labeled controlled test-token sandbox. The issuer role is project-controlled, the private witness is created by the existing demo issue flow, and the current LendingPool verifies that project commitment. Label all states **“Project Demo Credential”** / **“Demo Eligibility Proof”**; never display or describe them as official Dojang verification, Verified Balance, exchange balance, or production lending eligibility. This repo has no project-owned GIWA Sepolia deployments, so even this path is not currently a usable on-chain testnet flow.

## 7. Read-only check and regression results

| Check | Result | Meaning |
|---|---|---|
| Direct GIWA Sepolia reads using public RPC | **PASS** | Chain ID `91342`; the six contract addresses above returned code; current Upbit attester mapping read as `0x09B…49C6`; direct SchemaRegistry reads returned the two expected schema strings, resolver addresses, and `revocable=true`. No transaction was signed or sent. |
| `bun scripts/check-dojang-rpc.ts` | **PARTIAL / checker error** | RPC connectivity, chain ID, DojangScroll/AttesterBook/EAS code reads proceeded, then the script failed decoding `EAS.getSchemaRegistry()` because the call returned `0x`. A direct call to the documented SchemaRegistry address succeeded. No source code was changed to address this existing check failure. |
| Credentialed user / balance witness read | **NOT VERIFIED** | No eligible test wallet, attestation UID, or private witness was provided. This is unavailable evidence, not a claim that no such attestations exist. |
| `bun run contracts:test` | **PASS: 60/60** | Governance 16, Protocol 21, VerifierConformance 3, LendingIntegration 20. This confirms the current local implementation only; no Dojang Balance Root or Balance Merkle ZK behavior is covered. |
| Deployment / write transactions | **NOT RUN** | No contracts deployed and no external transactions broadcast. |

The checker failure does not mean the official EAS or schemas are absent: code and direct schema reads succeeded. It means the existing script expects a getter that returned no data at the queried address. That maintenance issue is outside this documentation-only scope.

## 8. Decision

**Official integration: BLOCKED. Stage B: NO-GO to begin the upgrade as specified until the blockers below are resolved.** The published external mechanism is real; this repository is not integrated with it; the direct user balance attestation is public; no private issuer witness channel or test-user credential has been confirmed; the full owner brief is absent; and the market's oracle/economic parameters remain unapproved. Proceed with the project-issued development credential only under the explicit demo label and existing test-asset limitations. A separately approved demo-only financial mechanics scope would need to state that it does not satisfy official Dojang balance eligibility.

Before Stage B begins, obtain:

1. The missing full owner brief and a final definition of whether Verified Address and Balance Root membership are both mandatory.
2. Written confirmation from the official issuer/GIWA of whether test users can obtain the required data and a private `(balance, salt, path)` witness without publishing the clear balance on-chain.
3. A consented test wallet, verified current root/attestation UID, and private witness fixture to validate the path without exposing real balance data.
4. Approved coin type, snapshot-age limit, threshold/policy version, root revocation handling, and root selection rules.
5. The independent Stage B financial parameter and oracle decisions in [`LENDING_UPGRADE_GAP_ANALYSIS.md`](LENDING_UPGRADE_GAP_ANALYSIS.md).

No Stage B implementation was started.
