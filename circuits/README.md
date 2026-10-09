# Private eligibility circuit

`private_eligibility/src/main.nr` is the source for the demo eligibility circuit. It constrains a private unsigned 64-bit value to be at least the public threshold and verifies a domain-separated Pedersen commitment over that value, a private salt, and the credential context.

The commitment input order is:

```text
[domainTag, privateValue, salt, wallet, policyId, policyVersion, threshold,
 credentialVersion, expiresAt, chainId, vaultAddress]
```

The public input order is fixed to match `RestrictedVault.enterVault`:

```text
[wallet, commitment, policyId, policyVersion, threshold,
 credentialVersion, expiresAt, chainId, vaultAddress]
```

`src/lib/zk/commitment.ts` creates the same Pedersen commitment for the issuer hook. The browser prover checks the imported witness with Noir, generates an EVM-targeted UltraHonk proof with Barretenberg, and runs local verification before returning it. The public circuit artifact is served from `public/circuits/private_eligibility.json`; the generated Solidity verifier is `contracts/src/generated/EligibilityHonkVerifier.sol`.

## Local conformance

```sh
bun run zk:compile
bun run zk:conformance
bun run contracts:test
```

The compile/conformance commands use the official Noir WASM compiler and Barretenberg packages. Barretenberg downloads public SRS data into ignored `circuits/cache/`. Conformance checks that a valid proof verifies locally, that under-threshold, mismatched-commitment, and wrong-wallet witnesses fail, and that the issuer hook's commitment matches the circuit. It writes a synthetic public proof fixture for Foundry. Foundry then calls the generated Solidity verifier through `EligibilityVerifierAdapter`, checking that valid proof bytes verify and altered public input/proof bytes fail.

The checked-in fixture contains only public test data: proof bytes and nine public inputs for a synthetic wallet, vault, and expiry. It contains no private value or salt. `TestOnlyVerifierFixture` in `contracts/test/Protocol.t.sol` is a separate Boolean fixture used to exercise vault boundary checks; it is not cryptographic proof evidence and must never be deployed.

This circuit demonstrates a project-issued test threshold. It does not prove a Dojang attestation, official holdings, KYC status, or a private transfer. The verifier and vault are not deployed, and no project on-chain transaction has been verified.
