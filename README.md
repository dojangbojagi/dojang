# GIWA Private Verifiable State

Next.js App Router foundation for a GIWA Sepolia private eligibility demonstration. The original HTML references and assets remain in `docs/`; the Next.js routes are functional integration scaffolds.

## Local development

1. Copy `.env.example` to `.env.local` and add only configuration you have. Project contract addresses are unset until a deployment exists.
2. Install with Bun: `bun install`.
3. Start the app: `bun run dev`.
4. Verify the app and local protocol with `bun run typecheck`, `bun run build`, `bun run contracts:build`, and `bun run contracts:test`.
5. Recompile and check circuit conformance with `bun run zk:compile` and `bun run zk:conformance`.

The six routes are `/`, `/dojang`, `/bojagi`, `/vault`, `/contracts`, and `/docs`. The browser proof path creates and locally verifies a Noir/Barretenberg proof when a matching credential witness and deployed context are configured. This workspace has no project contract deployment and no project wallet transactions have been verified.

See [the frontend integration handoff](docs/FRONTEND_INTEGRATION_HANDOFF.md) for hook types, state meanings, contract interfaces, configuration, and evidence status. See [the master development brief](docs/GIWA_Private_Verifiable_State_Master_Development_Brief.md) for product requirements and [the circuit README](circuits/README.md) for proof conformance details.
