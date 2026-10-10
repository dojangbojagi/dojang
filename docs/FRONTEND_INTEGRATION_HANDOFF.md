# Frontend Integration Handoff

**Checkpoint update (2026-10-10):** the existing six-route app and protocol are extended with a separate policy-2 lending market, dedicated credential/proof hooks, and supplier/collateral/borrow/repay interfaces. Lending is locally tested only; the LendingPool, registry, verifier, and controlled assets are not deployed to GIWA Sepolia. The integration points below do not require changes to Solidity or ZK internals.

## Ownership boundary

Codex owns `src/lib/config/`, `src/lib/contracts/`, `src/lib/protocol/`, `src/lib/credential/`, `src/lib/zk/`, `src/lib/lending/`, `src/hooks/`, `contracts/`, `circuits/`, and this document. Claude may replace the six `src/app/**/page.tsx` scaffolds and presentation components, while keeping route names, providers, hook contracts, and status meanings. Preserve the original HTML, CSS, JavaScript, fonts, and images in `docs/`.

Keep all credential checks, commitment construction, proof creation and verification, transaction simulation, writes, receipt handling, and error mapping in the hooks and protocol modules. Presentation components should call these interfaces and render their results.

## Routes and exact integration points

| Route | Current entry point | Logic to connect |
| --- | --- | --- |
| `/` | `src/app/page.tsx`, `WalletNetworkCard` | `useWalletNetwork()`; explain testnet and demo limitations; link into credential and proof flow |
| `/dojang` | `src/app/dojang/page.tsx`, `CredentialWitnessImporter` | `useDojangVerification(wallet)`, `useDemoCredential(wallet?)`, `useDemoCredentialIssuance()`; official Dojang and project demo credentials are separate sources |
| `/bojagi` | `src/app/bojagi/page.tsx`, `ProofGenerationPanel` | `useEligibilityProof()`; show witness readiness, proof generation, and local verification separately from on-chain verification |
| `/vault` | `src/app/vault/page.tsx`, `VaultActionPanel` | `useVaultAccess()` and `useEligibilityProof()` for vault; `useLendingMarket()`, `useLendingCredential()`, and `useLendingEligibilityProof()` are available for a future presentation integration without a new route or protocol rewrite |
| `/contracts` | `src/app/contracts/page.tsx` | `officialDojang`, `projectContracts`, and `invalidContractConfig`; separate official GIWA addresses from unconfigured project deployments |
| `/docs` | `src/app/docs/page.tsx` | Explain issuer trust, commitment privacy, local proof status, deployment status, and that this demo vault does not hold funds |

`src/components/providers.tsx` owns the stable `WagmiProvider`, `QueryClientProvider`, `RainbowKitProvider`, and in-memory `DemoWitnessProvider`. `SiteHeader` owns the shared wallet connect button. Claude can replace the page presentation and CSS but should leave those providers and protocol hooks in place.

## Providers, chain, and wallet

The provider config uses GIWA Sepolia only (chain ID `91342`), with an injected wallet connector by default. WalletConnect is added only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set. The public RPC is `NEXT_PUBLIC_GIWA_RPC_URL`, falling back to GIWA's rate-limited endpoint. `src/lib/config/server-env.ts` reserves `GIWA_RPC_URL` for server-only operations; current protocol reads and wallet transactions run in the browser.

`useWalletNetwork()` returns wagmi account fields plus:

```ts
{
  state: "disconnected" | "connecting" | "connected" | "wrong-network";
  isGiwaSepolia: boolean;
  switchToGiwaSepolia: () => Promise<unknown>;
  isSwitching: boolean;
}
```

Use `ConnectButton` from RainbowKit for wallet connection. Do not add a second wallet provider in page components.

## Available hooks and return types

### `useDojangVerification(wallet?)`

Reads `DojangScroll.isVerified(wallet, UPBIT_KOREA_ID)`, its attestation UID, then EAS `getAttestation(uid)`. It validates UID, recipient, issuer, schema, expiry, and revocation metadata.

```ts
{
  state: DojangState; // idle | checking | official-verified | no-official-credential |
                     // invalid | expired | revoked | read-error
  credential?: OfficialDojangCredential; // state, wallet, issuer, attestationUid, issuedAt,
                                         // expirationTime, revocationTime, schemaUid,
                                         // isValid, isVerified
  isLoading: boolean;
  error?: Error;
  refetch: () => Promise<unknown>;
}
```

No wallet is `idle`. A missing credential is reported only after a successful `isVerified` RPC read. The attestation UID query runs only when `isVerified` returns true because Dojang reverts for missing UID lookups. `invalid` means EAS considers the attestation invalid; malformed or mismatched attestation metadata and RPC failures are `read-error`. Official Dojang status is informational in this project: the demo vault does not claim to enforce official Dojang or KYC status. `credential` is populated only after the UID, recipient, issuer, schema, content, and EAS validity reads are consistent.

### `useDemoCredential(wallet?)`

Reads `DemoCredentialRegistry.getCredential(wallet, 1)`.

```ts
{
  state: DemoCredentialState; // disconnected | unconfigured | checking | missing |
                              // active | expired | revoked | read-error
  record?: DemoCredentialRecord; // wallet, commitment, issuer, issuedAt, expiresAt,
                                 // version, revoked
  error?: Error;
  refetch: () => Promise<unknown>;
  hasRegistry: boolean;
}
```

This is an issuer-created synthetic demo credential, never an official Dojang or holdings attestation. Policy 1 is a private value of at least `1,000` project demo test units; it is not a currency amount.

### `useDemoCredentialIssuance()`

The connected GIWA Sepolia wallet must have `ISSUER_ROLE` in the configured registry. The hook reads the current version, creates a cryptographically random field salt, computes the circuit's Pedersen commitment in the browser, simulates the registry call, requests a wallet signature, waits for the receipt, and confirms the stored version/commitment/expiry by readback. The contract checks `expectedVersion` to reject a stale concurrent issue.

```ts
{
  issueCredential: (input: {
    wallet: Address;       // credential subject
    privateValue: string;  // issuer's private demo value, decimal
    expiresAt: bigint;     // Unix seconds
  }) => Promise<DemoCredentialWitness>;
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
}
```

The returned witness has `{ format, wallet, policyId, commitment, privateValue, salt, expiresAt }`. It contains private data. Keep it in memory and provide it to the subject through a deliberate secure delivery flow; do not log, upload, place it in a URL, or send it to analytics. The hook does not automatically persist or export it. The registry stores only the commitment and issuer metadata. The issuer remains trusted to make a truthful commitment.

### `useDemoCredentialRevocation(wallet?)`

Reads the selected credential and exposes `state`, `record`, `revokeCredential()`, `transaction`, `isSubmitting`, and `refetch`. The connected GIWA Sepolia wallet must be the credential issuer or registry admin. The hook simulates the revoke call, waits for the receipt, reads the revoked flag back, then refreshes the credential query. A successful hash alone does not mean revocation is confirmed.

### Witness import

`CredentialWitnessImporter` accepts JSON in this format:

```json
{
  "format": "giwa-demo-credential-v1",
  "wallet": "0x…",
  "policyId": 1,
  "commitment": "0x<32-byte hex>",
  "privateValue": "1000",
  "salt": "0x<32-byte field hex>",
  "expiresAt": 0
}
```

The provider keeps the witness only in React memory; refresh or clear removes it. Import checks format and compares wallet, policy, commitment, and expiry to the active record. `Noir.execute` checks that the private value and salt open the commitment and satisfy the threshold when a proof is generated.

### `useEligibilityProof()`

```ts
{
  state: ProofState; // credential-required | ready-to-prove | generating | invalid |
                     // ready-to-submit | contract-unconfigured
  witnessMatchesRecord: boolean;
  proof?: EligibilityProof; // proof, fixed 9-value publicInputs, publicContext,
                            // createdAt, localVerification
  generateProof: () => Promise<EligibilityProof>;
  error?: string;
}
```

`generateProof()` checks the active record and wallet, executes the Noir circuit, generates an EVM-targeted UltraHonk proof with Barretenberg, locally verifies it, validates the public input order, then stores the proof in memory. `ready-to-submit` means only that a current proof passed local verification and matches the current credential context. It does not mean that a Solidity verifier accepted it or that a transaction occurred. Proof generation requires a configured vault address because the commitment binds the proof to that contract.

The browser loads the compiled circuit artifact from `/circuits/private_eligibility.json`. The circuit uses 16,384 points; browser Barretenberg initializes from the public 131,072-point SRS blocks required by its decompressor. The private value and salt stay in the browser; only the proof and public inputs are submitted. Prover initialization fetches public SRS data from `https://crs.aztec-cdn.foundation`.

### `useVaultAccess()`

```ts
{
  state: VaultState; // unconfigured | disconnected | checking | locked | eligible |
                     // access-granted | previously-granted | read-error
  hasAccess: boolean;
  threshold?: bigint;
  transaction: TransactionLifecycle;
  enterVault: (proof: EligibilityProof) => Promise<void>;
  refetch: () => Promise<unknown>;
  isSubmitting: boolean;
}
```

`eligible` means a locally verified proof matches the connected wallet, current credential, chain, and configured vault. `enterVault` checks the proof context and public inputs, simulates the call, requests a wallet signature, waits for the transaction receipt, and reads `hasAccess` back. Only a successful receipt and positive readback set the current-session state to `access-granted`. The contract's access flag is permanent for that wallet in this demo.

### Lending policy credential and proof hooks

Lending uses registry policy `2`, version `1`, threshold `1,000`, and the configured LendingPool address as the proof target. This is intentionally separate from the vault's policy `1`; a vault credential or proof cannot be reused to borrow. The current lending credential is an authorized issuer-created **demo** commitment. Official Dojang Verified Address remains informational and does not assert a private balance.

`useLendingCredential(wallet?)` reads `DemoCredentialRegistry.getCredential(wallet, 2)` and checks whether its issuer currently has `ISSUER_ROLE`:

```ts
{
  state: LendingCredentialState; // unconfigured | disconnected | checking | missing |
                               // active | expired | revoked | issuer-untrusted | read-error
  record?: DemoCredentialRecord;
  issuerAuthorized: boolean;
  error?: Error;
  refetch: () => Promise<unknown>;
  hasRegistry: boolean;
}
```

`useLendingCredentialIssuance()` is for the controlled demo issuer only. The connected wallet must hold the on-chain issuer role. It creates a commitment for policy `2` and the configured pool address, simulates and submits `recordCredential`, then checks the receipt and registry readback before returning the private witness:

```ts
{
  issueCredential: (input: {
    wallet: Address;
    privateValue: string;
    expiresAt: bigint;
  }) => Promise<DemoCredentialWitness>;
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
}
```

The returned witness contains the private value and salt. Deliver it securely; do not log, upload, put it in a URL, or send it to analytics. A controlled demo issuer must not be described as Dojang, an exchange, or a financial institution.

`useLendingEligibilityProof(witness?)` generates the existing circuit proof against the current policy-2 record and pool. It verifies the proof locally and checks the public inputs before returning it:

```ts
{
  state: LendingProofState; // unconfigured | disconnected | wrong-network |
                            // checking-credential | credential-required |
                            // credential-expired | credential-revoked |
                            // issuer-untrusted | witness-required | ready-to-prove |
                            // generating | proof-ready | invalid
  proof?: EligibilityProof;
  error?: string;
  generateProof: (witnessOverride?: DemoCredentialWitness) => Promise<EligibilityProof>;
}
```

`proof-ready` means only local verification and matching current context. Solidity independently verifies the proof again inside `LendingPool.borrow`.

### `useLendingMarket()`

The hook reads the configured pool's assets, symbols, decimals, available liquidity, supplier principal, debt, and the connected wallet's balances and position. It exposes the following typed shape:

```ts
{
  state: LendingMarketState; // unconfigured | disconnected | wrong-network |
                             // checking | ready | read-error
  summary?: LendingMarketSummary; // assets, decimals, available liquidity, total supplier principal, total debt
  position?: LendingUserPosition; // wallet balances/allowances, supplier position, collateral, debt, capacity
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
  refetch: () => Promise<void>;
  approveLendingAsset: (amount: bigint) => Promise<void>;
  approveCollateralAsset: (amount: bigint) => Promise<void>;
  supply: (amount: bigint) => Promise<void>;
  withdrawSupply: (amount: bigint) => Promise<void>;
  depositCollateral: (amount: bigint) => Promise<void>;
  withdrawCollateral: (amount: bigint) => Promise<void>;
  borrow: (amount: bigint, proof: EligibilityProof) => Promise<void>;
  repay: (amount: bigint) => Promise<void>;
}
```

All amounts use the relevant token's base units. Use `summary.*Asset.decimals` when parsing or displaying amounts. Approvals are explicit and token-specific. Each write is simulated first, sent through the existing wagmi wallet, receipt-checked, and confirmed by a corresponding state readback. If a receipt succeeds but expected state is not observable, the hook reports `rpc-error` with the transaction hash instead of claiming the action is complete. `borrow` rejects locally verified proofs that do not bind the connected wallet, active policy-2 commitment/version, chain `91342`, threshold, expiry, and configured LendingPool; the contract repeats these checks.

This hook does not mint assets or issue credentials. Lending and collateral assets are read from the configured pool, so no sample deployment address is built into the UI. Current market settings are fixed at 1:1 demo asset price, 50% LTV, and zero interest; these are not production oracle or yield guarantees. See [LENDING_MVP_ARCHITECTURE.md](LENDING_MVP_ARCHITECTURE.md) for limitations and local evidence.

## Credential verification, proof, and transaction states

| Concern | States | Meaning |
| --- | --- | --- |
| Official Dojang | `checking`, `official-verified`, `no-official-credential`, `invalid`, `expired`, `revoked`, `read-error`, `idle` | Official Dojang/EAS read result; kept separate from project demo credentials |
| Project credential | `checking`, `active`, `missing`, `expired`, `revoked`, `read-error`, `unconfigured`, `disconnected` | Issuer record in the project registry |
| Witness | no witness, metadata matched, circuit checked | Metadata match is not cryptographic proof; the circuit checks the opening during generation |
| Proof | `credential-required`, `ready-to-prove`, `generating`, `ready-to-submit`, `invalid`, `contract-unconfigured` | `ready-to-submit` is local proof verification only |
| Vault | `locked`, `eligible`, `access-granted`, `previously-granted`, `read-error`, `unconfigured`, `disconnected`, `checking` | `eligible` is local proof readiness; access states come from the contract |
| Lending credential | `checking`, `active`, `missing`, `expired`, `revoked`, `issuer-untrusted`, `read-error`, `unconfigured`, `disconnected` | `active` includes current issuer-role verification |
| Lending proof | `checking-credential`, `credential-required`, `credential-expired`, `credential-revoked`, `issuer-untrusted`, `witness-required`, `ready-to-prove`, `generating`, `proof-ready`, `invalid`, `unconfigured`, `disconnected`, `wrong-network` | `proof-ready` is local proof verification only; `borrow` requires Solidity verification |
| Lending market | `unconfigured`, `disconnected`, `wrong-network`, `checking`, `ready`, `read-error` | `ready` means configured reads completed; it does not indicate user eligibility or available credit |
| Transaction | `idle`, `simulating`, `awaiting-signature`, `submitted`, `confirming`, `confirmed`, `reverted`, `rejected`, `rpc-error` | Lending `confirmed` requires receipt plus expected state readback; `rpc-error` can retain a successfully mined hash if readback failed |

## Circuit, commitment, and contract interface

`circuits/private_eligibility/src/main.nr` proves `private_value >= threshold` and that a domain-separated Pedersen commitment opens to the private value, salt, and complete public context. The commitment fields, in order, are:

```text
[domainTag, privateValue, salt, wallet, policyId, policyVersion, threshold,
 credentialVersion, expiresAt, chainId, vaultAddress]
```

The circuit's public input order is exactly:

```text
[wallet, commitment, policyId, policyVersion, threshold,
 credentialVersion, expiresAt, chainId, vaultAddress]
```

The generated EVM verifier is `contracts/src/generated/EligibilityHonkVerifier.sol`. `EligibilityVerifierAdapter` converts the vault's fixed `uint256[9]` tuple to the generated verifier's `bytes32[]` interface. `RestrictedVault` independently checks every public context field against the active issuer record and its own chain/address before calling the immutable verifier.

`contracts/src/DemoCredentialRegistry.sol`:

- `grantRole(ISSUER_ROLE, issuer)` / `revokeRole(...)`: admin-only issuer role management.
- `recordCredential(wallet, policyId, commitment, expiresAt, expectedVersion)`: issuer-only; creates the next version only if `expectedVersion` is still current.
- `revokeCredential(wallet, policyId)`: issuer or admin only.
- `getCredential(wallet, policyId)`: returns wallet, commitment, issuer, issue/expiry times, version, and revocation flag.
- Events expose commitment and issuance metadata, never the private value or salt.

`contracts/src/RestrictedVault.sol`:

- Constructor fixes the registry and verifier and requires chain ID `91342`.
- Policy ID/version are `1`; `threshold()` is `1,000` demo test units.
- `enterVault(bytes proof, uint256[9] publicInputs)` grants an access flag after credential, context, and verifier checks; it does not custody funds or accept deposits.
- Duplicate entry reverts. `VaultAccessGranted` includes wallet, policy, credential version, and commitment only.

`contracts/test/Protocol.t.sol` includes `TestOnlyVerifierFixture`, a Boolean test double used only for vault boundary tests. It is not a ZK verifier and must never be deployed or described as proof evidence. `contracts/test/VerifierConformance.t.sol` separately deploys the generated verifier and checks a real Noir proof fixture.

## GIWA and project addresses

| Item | Address / ID | Status |
| --- | --- | --- |
| GIWA Sepolia | chain `91342`, RPC `https://sepolia-rpc.giwa.io`, explorer `https://sepolia-explorer.giwa.io` | Official public testnet config; RPC is rate limited |
| DojangScroll | `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` | Official GIWA Sepolia address |
| DojangAttesterBook | `0xDA282E89244424E297Ce8e78089B54D043FB28B6` | Official GIWA Sepolia address |
| EAS | `0x4200000000000000000000000000000000000021` | Official GIWA Sepolia address |
| UPBIT KOREA attester | `0x09B170CA2A006081042992bCE7379B85a02149C6` | Official GIWA Sepolia registry result and attester |
| UPBIT KOREA attester ID | `0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034` | Official GIWA ID |
| Verified Address schema | `0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08` | Official GIWA testnet schema |
| Demo registry, verifier, vault, lending pool | unset | Not deployed; no project transaction has been broadcast |

Official references: [GIWA Sepolia network setup](https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa), [Dojang contracts](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts), and [Verified Address integration](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/verified-address).

## Environment requirements

Copy `.env.example` to `.env.local` (or update the local `.env`) and configure:

- `NEXT_PUBLIC_GIWA_RPC_URL`: optional override for the rate-limited public GIWA Sepolia RPC.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: optional; injected connector works without it.
- `NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT`: deployed demo registry address.
- `NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT`: verifier address for configuration display; the vault itself is wired to its immutable verifier in its constructor.
- `NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT`: deployed vault address. Credential commitments and proofs bind to it.
- `NEXT_PUBLIC_LENDING_POOL_CONTRACT`: deployed lending market address. Lending credentials and proofs bind to this pool; the hook reads both token addresses from it.
- `GIWA_RPC_URL`: reserved server-only setting; current hook reads use the public RPC.
- `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DESCRIPTION`, `NEXT_PUBLIC_APP_TAGLINE`: app copy.

Contract addresses are not defaulted to example values. Invalid local placeholders do not resolve as addresses. The current workspace has no valid project addresses or WalletConnect project ID.

## Error types

`ProtocolError` exposes stable `code` and user-readable `message`. Codes include `WALLET_REQUIRED`, `WRONG_NETWORK`, `CONTRACTS_UNCONFIGURED`, `LENDING_NOT_CONFIGURED`, `INVALID_AMOUNT`, `INVALID_CREDENTIAL`, `ISSUER_NOT_AUTHORIZED`, `CREDENTIAL_VERSION_CHANGED`, `CREDENTIAL_REQUIRED`, `CREDENTIAL_MISMATCH`, `CREDENTIAL_EXPIRED`, `CREDENTIAL_REVOKED`, `INVALID_PROOF`, `INSUFFICIENT_LIQUIDITY`, `INSUFFICIENT_COLLATERAL`, `BORROWING_CAPACITY_EXCEEDED`, `TRANSACTION_STATE_UNCONFIRMED`, `ALREADY_GRANTED`, `TRANSACTION_REJECTED`, `INSUFFICIENT_FUNDS`, and `RPC_ERROR`. Lending custom errors are represented by `LendingContractErrorName` in `src/lib/protocol/types.ts`; `explainProtocolError(error)` maps common wallet, registry, vault, market, and network errors to UI copy. Presentation components should show the returned message and not infer success from a submitted transaction hash.

## Checkpoint and evidence

- **Implemented:** six App Router routes, Bun manifest/lockfile, environment schema, GIWA Sepolia chain, RainbowKit/wagmi/viem providers, official Dojang read hook, demo credential issue/read/revoke hooks and contracts, typed protocol hooks, Noir circuit/artifact, browser prover integration, generated verifier/adapter, and vault transaction/readback flow.
- **Previously recorded frontend checkpoint (2026-10-09):** the six routes had passed typecheck/build. On this lending checkpoint, `bun run typecheck` and the TypeScript stage of `bun run build` fail at `src/components/reference-effects.tsx:15` with `TS18048: 'revealObserver' is possibly 'undefined'`. Next.js production compilation itself completed before that typecheck failure. This visual-effects file was left untouched under the protocol-only scope; do not present the earlier checkpoint as a current passing build.
- **Verified read-only on GIWA Sepolia:** `bun run dojang:check` returned chain ID `91342` and UPBIT attester `0x09B170CA2A006081042992bCE7379B85a02149C6`. For synthetic `0x…dEaD`, `isVerified` returned false and its absent-UID lookup reverted as expected. EAS returned `false` for the zero UID and a zero UID record. The script also checks valid and malformed ABI-encoded `bool isVerified` payloads. No wallet was supplied, so no positive personal credential result is claimed.
- **Lending proof fixture:** `bun run lending:proof-fixture` generated an 8,000-byte proof with nine public inputs and locally verified it with Barretenberg. The circuit rejected a correctly commitment-bound under-threshold witness. The public fixture contains no private value or salt.
- **Foundry tests:** `bun run contracts:test` passed all 44 tests: 21 registry/vault boundary tests, 3 generated-verifier conformance tests, and 20 lending integration tests using the generated verifier and real proof fixture. `bun run contracts:build` passed. Foundry prints non-fatal warnings in generated verifier code and existing timestamp comparisons, plus a marker typecast and event-order warning in the new lending contracts.
- **Local Anvil lending lifecycle:** `bun run lending:anvil` dynamically deployed the real verifier, adapter, registry, controlled tokens, and pool to a local chain with ID `91342`; generated a proof for that ephemeral pool; verified it locally and on-chain; then supplied, deposited, borrowed, partially repaid, withdrew collateral, fully repaid, and withdrew supplier principal. Under-threshold witness, corrupted proof, and above-LTV borrowing were rejected. The borrower finished with zero debt and no collateral held by the pool; the supplier recovered all principal. Example local borrow receipt: `0x2d19ff4709264bb9b0a965be40840d33c627cc3542d61e9aadcc78c13d470ca5`, local block `17`. This is local-only evidence, not a GIWA transaction.
- **Verified in a real browser and local Anvil:** `bun run test:browser` passed against the freshly compiled artifact. The browser generated and locally verified an 8,000-byte proof in 16.2 seconds. The generated Solidity verifier accepted it and the local RestrictedVault receipt/readback granted access. Under-threshold witnesses, invalid proof bytes, wrong-wallet use, a missing credential, unauthorized issuance, and replay were rejected. The local Anvil transaction was `0x3eb955cbd528ac1782afb4bcdbbf3c3d70a39298cc08db6cb65da2c4cb51cfd8` at local block 10; it is not a GIWA transaction.
- **Not deployed to GIWA Sepolia:** project registry, generated verifier, adapter, vault, controlled assets, and LendingPool addresses remain unset. No lending credential or transaction has been broadcast to GIWA. The only live RPC evidence above covers read-only Dojang/EAS calls.
- **Local test fixtures:** `TestOnlyVerifierFixture` is a Boolean double used only for vault boundary tests. It is not proof evidence and must never be deployed. Generated-verifier conformance and browser E2E use the actual generated verifier.
- **Compiler setup:** Foundry uses pinned `solc-js` 0.8.28 through `contracts/solc-wrapper.sh` because the native compiler download endpoint was unavailable. Noir conformance downloads public Barretenberg SRS data into ignored `circuits/cache/`, separate from Foundry's cache.
- **Foundry warning:** Foundry could not write its global signature cache under the user's home directory; the local tests and build still pass.

Local commands (lint is not currently configured as a project script):

```sh
bun install
bun run dev
bun run typecheck
bun run build
bun run contracts:build
bun run contracts:test
bun run lending:proof-fixture
bun run lending:anvil
bun run zk:compile
bun run zk:conformance
bun run dojang:check
bun run test:browser
```

Do not claim project deployment or testnet transactions until their addresses and transaction receipts are independently confirmed. Never deploy the test-only verifier fixture.
