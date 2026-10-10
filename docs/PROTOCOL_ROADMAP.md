# Protocol Roadmap

This roadmap describes the independent Private Verifiable State Protocol. GIWA Sepolia is its external execution network; it is not the product brand. Statuses below are tied to repository and deployment evidence, not network-wide activity.

## Milestones

| Milestone | Status | Evidence or remaining work |
| --- | --- | --- |
| 1. Protocol Foundation | Locally validated | Foundry protocol, generated-verifier, and lending suites pass locally. The local Anvil path generates a proof, verifies it with the Solidity verifier, exercises lending, and rejects invalid proof, under-threshold witness, and over-capacity borrow cases. No GIWA deployment is recorded. |
| 2. GIWA Testnet Launch | Pending deployment | Deploy the project-owned contracts on GIWA Sepolia, verify their source, record addresses and transaction receipts, configure the app, then complete the wallet procedure in [deployment readiness](DEPLOYMENT_READINESS.md). |
| 3. Public Beta | Planned | Requires a verified testnet deployment, completed wallet testing, operational support, and a reviewed public-beta scope. |
| 4. Security and Risk Infrastructure | Planned | Requires an independent security review and explicit risk controls appropriate to any expanded use. No audit or review is claimed. |
| 5. Ecosystem Expansion | Future | Consider only after the testnet launch and security work. No integrations, partnerships, grants, or accelerator participation are claimed. |

## Infrastructure boundaries

- **GIWA Sepolia** is the external EVM execution network.
- **Dojang and EAS** are external attestation infrastructure. The app reads the official Dojang Verified Address attestation; it does not own those contracts.
- **Bojagi** is a conceptual privacy reference. This repository does not implement a Bojagi private-transfer protocol.
- **EligibilityVerifierAdapter and the generated Honk verifier** are project-owned proof verification contracts.
- **RestrictedVault** is project-owned proof-gated access state. It does not custody funds.
- **LendingPool and ControlledTestToken** are project-owned, non-production lending demonstration contracts and capped demo assets.
- **GIWA Explorer** is an external source for inspecting public chain records. Explorer network totals are not protocol usage statistics.

## Status rules

Local Foundry and Anvil results support only the “locally validated” status. A testnet milestone requires real GIWA Sepolia deployment receipts and verified deployed bytecode. Never use local addresses, local transaction hashes, or network-wide counters as project deployment or usage evidence.
