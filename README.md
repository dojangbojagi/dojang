# GIWA Private Verifiable State

Next.js App Router foundation for a GIWA Sepolia private eligibility demonstration. The original HTML references and assets remain in `docs/`; the Next.js routes are functional integration scaffolds.

## Local development

1. Copy `.env.example` to `.env.local` and add only configuration you have. Project contract addresses are unset until a deployment exists.
2. Install with Bun: `bun install`.
3. Start the app: `bun run dev`.
4. Verify the app and local protocol with `bun run typecheck`, `bun run build`, `bun run contracts:build`, and `bun run contracts:test`.
5. Recompile and check circuit conformance with `bun run zk:compile` and `bun run zk:conformance`.

The eight routes are `/`, `/dojang`, `/dao`, `/bojagi`, `/vault`, `/lending`, `/contracts`, and `/docs`.

## Public Mainnet visibility on Vercel

For the current public release, set this Production environment variable in Vercel Project Settings → Environment Variables:

```text
NEXT_PUBLIC_GYEVO_MAINNET_VISIBLE=false
```

Leave it unset or blank to use the same Testnet-only default. After changing it, create a new frontend deployment; `NEXT_PUBLIC_` values are embedded in the build and do not update an existing deployment at runtime. When the project authorizes public Mainnet visibility, change the value to `true` and deploy a new build. The separate `NEXT_PUBLIC_GYEVO_DAO_PHASE2_VISIBLE` setting is unchanged and can be configured independently.

## Product flow

The public story connects two journeys:

1. **Verified governance:** an official GIWA Dojang Verified Address check establishes eligibility for project DAO membership and public voting.
2. **Private utility:** the controlled Lending demonstration uses its own project-issued policy-2 demo credential and matching Bojagi-inspired ZK eligibility proof. It is not an official Dojang credential and does not implement a Bojagi private transfer. The `/bojagi` policy-1 proof is Vault-specific and cannot be reused for Lending.

The `/vault` route remains implemented and accessible as a legacy/secondary technical demonstration of proof-gated access. It holds no funds and is not a primary product path. The browser prover creates and locally verifies a Noir/Barretenberg proof when a matching credential witness and deployed context are configured. Project contracts have not been deployed in this workspace, and no project wallet transactions have been verified.

Latest local validation checkpoint: `bun run contracts:test` passes 60 Foundry tests (including 16 governance tests), and `bun run typecheck` and `bun run build` pass. These are local results, not GIWA Sepolia deployment or transaction evidence.

See [the final frontend integration map](docs/FRONTEND_FINAL_INTEGRATION_MAP.md) for the current hook and route map, [the frontend integration handoff](docs/FRONTEND_INTEGRATION_HANDOFF.md) for earlier hook types, state meanings, contract interfaces, configuration, and evidence status. See [the master development brief](docs/GIWA_Private_Verifiable_State_Master_Development_Brief.md) for product requirements and [the circuit README](circuits/README.md) for proof conformance details.
