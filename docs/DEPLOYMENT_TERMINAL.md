# Deployment Terminal

The deployment console is an inspection and local simulation tool. It does not deploy contracts, submit wallet transactions, or publish verification requests.

## Commands

```sh
bun run deploy:ascii
bun run deploy:status
bun run deploy:replay
bun run deploy:status --record
bun run deploy:replay --record
bun run --silent deploy:simulate -- script/DeployGovernanceGIWASepolia.s.sol:DeployGovernanceGIWASepolia
```

`deploy:status` reads the configured RPC chain ID, latest block, optional signer balance, project contract bytecode, Foundry broadcast artifacts, and Blockscout source-verification metadata. `deploy:replay` performs the same read-only receipt checks and lists only successful GIWA Sepolia contract-creation receipts. Neither command replays or submits a transaction. `deploy:ascii` displays branding without making RPC calls.

`deploy:simulate` delegates to the existing `scripts/forge-simulate.sh` temporary-output wrapper. Its broadcast, verification, and signer arguments are rejected. Forge simulation can execute a deployment script in memory; it does not publish transactions. Use Bun's outer `--silent` flag when forwarding options so Bun does not echo the forwarded command line. The existing `deployment:simulate` script remains available.

`--record` changes terminal presentation only. In an interactive color terminal it enables typewriter output, a spinner while read-only inspection is running, and a completion progress bar. It does not change the report inputs, Forge arguments, signer selection, or transaction behavior. Non-interactive output stays plain and immediate.

## Branding and environment

Brand precedence is `DEPLOY_BRAND_NAME`, then `NEXT_PUBLIC_APP_NAME`, then the neutral `UNNAMED PROJECT` fallback. The renderer removes control sequences, limits the name length, and uses a readable text fallback on narrow terminals. It never sets terminal background colors.

Supported `DEPLOY_ASCII_THEME` values are `lime` (default), `ice`, and `mono`. ANSI output is enabled only on a TTY and is disabled when `NO_COLOR` is set.

RPC selection is `DEPLOY_RPC_URL`, then `GIWA_RPC_URL`, then `NEXT_PUBLIC_GIWA_RPC_URL`, then the centralized app RPC default. Only the public URL is used; the console does not print it. Signer display uses the public `DEPLOY_SIGNER_ADDRESS`, falling back to `GIWA_ADMIN_ADDRESS`. Status and replay do not inspect signer secrets. The simulation command delegates to the existing Forge wrapper with the current process environment, but it never prints that environment and rejects explicit signer flags.

The deployment CLI configuration variables are:

| Variable | Purpose |
| --- | --- |
| `DEPLOY_BRAND_NAME` | Optional terminal-only brand override |
| `DEPLOY_ASCII_THEME` | `lime`, `ice`, or `mono` |
| `DEPLOY_RPC_URL` | Optional read-only RPC override |
| `DEPLOY_SIGNER_ADDRESS` | Optional public address for readiness/balance display |

Deployment addresses are read from the existing `GIWA_*_ADDRESS` outputs and matching `NEXT_PUBLIC_*_CONTRACT` values. Empty values remain unconfigured; predicted addresses from a dry run are never accepted as deployment evidence.

## Evidence rules

- GIWA Sepolia is accepted only when the RPC reports chain ID `91342`. A different chain blocks project contract claims.
- Configured addresses are checked for bytecode. A successful bytecode lookup means `CODE PRESENT`; by itself it does not prove which source or constructor was deployed.
- A receipt counts as confirmed only when a Foundry broadcast artifact is explicitly associated with chain `91342`, the RPC returns a successful receipt for that hash, the receipt contract address matches the artifact, and bytecode is present at that address.
- Artifacts on chain `31337` or `1337` are counted as local Anvil evidence and excluded from GIWA deployment totals. Unclassified artifacts are also excluded.
- `SOURCE VERIFIED` is shown only when Blockscout's v2 address response explicitly returns `is_verified: true`. Explorer links alone are not verification evidence. If the explorer API is unavailable or does not return that field, verification is `UNKNOWN`.
- `DojangScroll`, `DojangAttesterBook`, and EAS appear as external infrastructure, never as project-owned contracts. `UtilizationRateModel` is an internal Solidity library included by `LendingPoolV2`, not a separate contract deployment.
- An empty broadcast directory produces zero confirmed receipts; it is not interpreted as deployment success.

Blockscout status checks the v2 address endpoint, [`/api/v2/addresses/{address_hash}`](https://github.com/orgs/blockscout/discussions/12687), and accepts only an explicit `is_verified: true` field. GIWA Explorer availability may differ from other Blockscout installations; an API failure or missing field is reported as unknown rather than guessed.

## Recording commands

For a presentation capture after deployment artifacts exist:

```sh
DEPLOY_BRAND_NAME="Your Project Name" DEPLOY_ASCII_THEME=lime bun run deploy:status --record
DEPLOY_BRAND_NAME="Your Project Name" DEPLOY_ASCII_THEME=ice bun run deploy:replay --record
```

These commands remain read-only. A real deployment command is intentionally not provided; any future broadcast flow needs separate authorization and explicit chain, signer, prerequisite, funding, role, receipt, and bytecode checks.
