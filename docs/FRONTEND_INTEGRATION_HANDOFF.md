# Frontend Integration Handoff

**Checkpoint:** the six-route Next.js app, wallet providers, credential issue/read paths, browser proof hook, generated Solidity verifier, vault authorization, and local conformance tests are implemented. Project contract addresses are not configured and no project contracts are deployed. This file is the interface contract for presentation work.

## Ownership boundary

Codex owns `src/lib/config/`, `src/lib/contracts/`, `src/lib/protocol/`, `src/lib/credential/`, `src/lib/zk/`, `src/hooks/`, `contracts/`, `circuits/`, and this document. Claude may replace the six `src/app/**/page.tsx` scaffolds and presentation components, while keeping route names, providers, hook contracts, and status meanings. Preserve the original HTML, CSS, JavaScript, fonts, and images in `docs/`.

Keep all credential checks, commitment construction, proof creation and verification, transaction simulation, writes, receipt handling, and error mapping in the hooks and protocol modules. Presentation components should call these interfaces and render their results.

## Routes and exact integration points

| Route | Current entry point | Logic to connect |
| --- | --- | --- |
| `/` | `src/app/page.tsx`, `WalletNetworkCard` | `useWalletNetwork()`; explain testnet and demo limitations; link into credential and proof flow |
| `/dojang` | `src/app/dojang/page.tsx`, `CredentialWitnessImporter` | `useDojangVerification(wallet)`, `useDemoCredential(wallet?)`, `useDemoCredentialIssuance()`; official Dojang and project demo credentials are separate sources |
| `/bojagi` | `src/app/bojagi/page.tsx`, `ProofGenerationPanel` | `useEligibilityProof()`; show witness readiness, proof generation, and local verification separately from on-chain verification |
| `/vault` | `src/app/vault/page.tsx`, `VaultActionPanel` | `useVaultAccess()` and `useEligibilityProof()`; submit only the current locally verified proof and show access only after receipt plus contract readback |
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
                     // expired | revoked | read-error
  credential?: OfficialDojangCredential; // wallet, issuer, attestationUid, issuedAt,
                                         // expirationTime, revocationTime, schemaUid, isVerified
  isLoading: boolean;
  error?: Error;
  refetch: () => Promise<unknown>;
}
```

No wallet is `idle`. A missing credential is reported only after a successful RPC read. RPC or attestation integrity failures are `read-error`. Official Dojang status is informational in this project: the demo vault does not claim to enforce official Dojang or KYC status.

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

The browser loads the compiled circuit artifact from `/circuits/private_eligibility.json` and initializes the 16,384 point SRS for Barretenberg. The private value and salt stay in the browser; the proof and public inputs are what may be submitted. A browser may fetch public SRS data from the Barretenberg distribution endpoint during prover initialization.

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

## Credential verification, proof, and transaction states

| Concern | States | Meaning |
| --- | --- | --- |
| Official Dojang | `checking`, `official-verified`, `no-official-credential`, `expired`, `revoked`, `read-error`, `idle` | Official Dojang/EAS read result; kept separate from project demo credentials |
| Project credential | `checking`, `active`, `missing`, `expired`, `revoked`, `read-error`, `unconfigured`, `disconnected` | Issuer record in the project registry |
| Witness | no witness, metadata matched, circuit checked | Metadata match is not cryptographic proof; the circuit checks the opening during generation |
| Proof | `credential-required`, `ready-to-prove`, `generating`, `ready-to-submit`, `invalid`, `contract-unconfigured` | `ready-to-submit` is local proof verification only |
| Vault | `locked`, `eligible`, `access-granted`, `previously-granted`, `read-error`, `unconfigured`, `disconnected`, `checking` | `eligible` is local proof readiness; access states come from the contract |
| Transaction | `idle`, `simulating`, `awaiting-signature`, `submitted`, `confirming`, `confirmed`, `reverted`, `rejected`, `rpc-error` | `confirmed` is receipt status; vault access additionally requires readback |

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
| EAS | `0x4200000000000000000000000000000000000021` | Official GIWA Sepolia address |
| UPBIT KOREA attester | `0x4097bF3Cb731AEB3E501b910B33B2aF9Fa68E38` | Official GIWA testnet attester |
| UPBIT KOREA attester ID | `0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034` | Official GIWA ID |
| Verified Address schema | `0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08` | Official GIWA testnet schema |
| Demo registry, verifier, vault | unset | Not deployed; no project transaction has been broadcast |

Official references: [GIWA Sepolia network setup](https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa), [Dojang contracts](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts), and [Verified Address integration](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/verified-address).

## Environment requirements

Copy `.env.example` to `.env.local` (or update the local `.env`) and configure:

- `NEXT_PUBLIC_GIWA_RPC_URL`: optional override for the rate-limited public GIWA Sepolia RPC.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: optional; injected connector works without it.
- `NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT`: deployed demo registry address.
- `NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT`: verifier address for configuration display; the vault itself is wired to its immutable verifier in its constructor.
- `NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT`: deployed vault address. Credential commitments and proofs bind to it.
- `GIWA_RPC_URL`: reserved server-only setting; current hook reads use the public RPC.
- `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DESCRIPTION`, `NEXT_PUBLIC_APP_TAGLINE`: app copy.

Contract addresses are not defaulted to example values. Invalid local placeholders do not resolve as addresses. The current workspace has no valid project addresses or WalletConnect project ID.

## Error types

`ProtocolError` exposes stable `code` and user-readable `message`. Codes are `WALLET_REQUIRED`, `WRONG_NETWORK`, `CONTRACTS_UNCONFIGURED`, `INVALID_CREDENTIAL`, `ISSUER_NOT_AUTHORIZED`, `CREDENTIAL_VERSION_CHANGED`, `CREDENTIAL_REQUIRED`, `CREDENTIAL_MISMATCH`, `CREDENTIAL_EXPIRED`, `CREDENTIAL_REVOKED`, `INVALID_PROOF`, `ALREADY_GRANTED`, `TRANSACTION_REJECTED`, `INSUFFICIENT_FUNDS`, and `RPC_ERROR`. `explainProtocolError(error)` maps common wallet, registry, vault, and network errors to UI copy. Presentation components should show the returned message and not infer success from a submitted transaction hash.

## Checkpoint and evidence

- **Implemented:** six App Router routes, Bun manifest/lockfile, environment schema, GIWA Sepolia chain, RainbowKit/wagmi/viem providers, official Dojang read hook, demo credential issue/read/revoke hooks and contracts, typed protocol hooks, Noir circuit/artifact, browser prover integration, generated verifier/adapter, and vault transaction/readback flow.
- **Locally verified:** `bun run typecheck`, `bun run build`, `bun run contracts:build`, and `bun run contracts:test`. The local suite includes 21 registry/vault boundary tests and 3 generated-verifier conformance tests. The valid circuit proof is accepted by the generated Solidity verifier; changed proof bytes and changed public input are rejected.
- **Locally verified, proof generation:** `bun run zk:conformance` generated an 8,000-byte proof with nine public inputs. Noir/Barretenberg locally verified it and rejected under-threshold, mismatched-commitment, and wrong-wallet witnesses. The corresponding synthetic public proof fixture is checked into `circuits/testdata/`; it contains no private witness.
- **Not browser-interaction verified:** the browser prover is typechecked and included in the production bundle, but this workspace did not have the `agent-browser` CLI installed for an interactive browser proof run. Browser runtime initialization and proof latency therefore remain to be verified in the target browser.
- **Not deployed / not on-chain verified:** the demo registry, generated verifier, adapter, and vault have no configured addresses. No credential-issuance or vault transaction has been broadcast by this work. The official Dojang/EAS RPC reads have not been confirmed from this workspace.
- **Simulated in tests only:** `TestOnlyVerifierFixture` accepts one test byte string for contract boundary tests. That is not cryptographic evidence. Generated verifier conformance is covered separately with the actual generated proof fixture.
- **Compiler setup:** Foundry uses pinned `solc-js` 0.8.28 through `contracts/solc-wrapper.sh` because the native compiler download endpoint was unavailable. Noir conformance downloads public Barretenberg SRS data into ignored `circuits/cache/`, separate from Foundry's cache.
- **Foundry warning:** Foundry could not write its global signature cache under the user's home directory; the local tests and build still pass.

Local commands:

```sh
bun install
bun run dev
bun run typecheck
bun run build
bun run contracts:build
bun run contracts:test
bun run zk:compile
bun run zk:conformance
```

Do not claim project deployment or testnet transactions until their addresses and transaction receipts are independently confirmed. Never deploy the test-only verifier fixture.
