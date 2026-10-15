# GYEVO DAO Phase 2: Security and Deployment

## Scope and current status

DAO Phase 2 is an isolated Robinhood Chain Testnet implementation for chain `46630`. It adds two contracts over the existing confirmed Testnet credential registry, eligibility verifier, and LendingPoolV2. It does not replace or modify DAO Phase 1, Lending V2, or any Mainnet contract.

The implementation is locally compiled and tested. It is **not deployed**. Both new contracts start paused, and the deployment script performs no initialization writes to the existing protocol.

## Membership and reputation model

Phase 2 membership uses project Policy 5:

1. The operator scans the confirmed LendingPoolV2 contract from its real deployment block to a finalized block.
2. Reputation model V1 assigns one point for participation, one point for borrowing, two points for one or more complete repayments, and subtracts two points if any liquidation occurred. Repeated volume does not add points.
3. An authorized reputation issuer records a commitment, evidence digest, inspected block interval, expiry, and monotonically increasing credential version.
4. An authorized project credential issuer records the same commitment, expiry, and version as a Policy 5 credential.
5. The member generates the existing genuine Noir/Barretenberg eligibility proof. Public inputs bind the proof to the wallet, commitment, Policy 5, policy version, current reputation threshold, credential version, expiry, chain `46630`, and the Phase 2 governance address.
6. The deployed verifier must accept the proof before the governance contract registers membership.

The score issuer is a trust boundary. The contract authenticates the issuer and evidence digest but cannot independently replay historical Lending logs. The repository operator recomputes the complete bounded event history before claim simulation or submission. Claim revocation, credential revocation, issuer-role removal, expiry, version drift, and a governed threshold change all make the membership fail closed.

## Privacy model

- The proof hides the reputation score and salt from proof calldata.
- The wallet, commitment, threshold, credential metadata, chain, and governance address are public inputs.
- Lending V2 events are public. An observer may independently infer activity or reproduce the score model.
- A ballot commitment hides the choice during the commit window.
- The proposal-scoped nullifier prevents the same wallet from committing twice.
- The reveal transaction discloses the choice and links it to the wallet.

This is private-score membership and sealed-until-reveal voting. It is not anonymous voting. It does not provide unlinkability, coercion resistance, or Sybil resistance beyond the project credential and reputation issuance rules.

## Proposal lifecycle

An active member can create a proposal that changes only `minimumReputation`, bounded to `1..100`. A proposal moves through Pending, Commit, Reveal, Succeeded or Rejected, Expired, and Executed states. Quorum counts revealed ballots. Reveal and finalization remain callable while paused so an emergency pause cannot strand already committed ballots. Proposal creation, registration, commit, and execution are paused.

## Candidate Testnet parameters requiring owner approval

| Setting | Candidate | Unit |
| --- | ---: | --- |
| Commit period | `3600` | seconds |
| Reveal period | `3600` | seconds |
| Execution window | `604800` | seconds |
| Quorum | `2` | revealed ballots |
| Minimum reputation | `3` | model V1 points |

The owner must approve these values and provide five distinct public addresses for deployer, administrator, existing credential issuer, reputation issuer, and pause authority. The credential issuer must already hold `ISSUER_ROLE` on the deployed project credential registry.

## Read-only and local preparation

```bash
bun run robinhood:dao2 --help
bun run robinhood:dao2 evidence <wallet>
bun run robinhood:dao2 prepare-membership <wallet> 30 <protected-witness-path>
```

The preparation command creates a mode-`0600` witness and matching evidence file. It refuses a score below the live governance threshold and does not sign or submit a transaction.

## Deployment simulation

Populate the `RH_TESTNET_PHASE2_*` inputs documented in `.env.example`, then run:

```bash
bun run robinhood:dao2:simulate
```

The simulation script rejects signer and broadcast flags. It validates chain `46630`, dependency bytecode, the Lending V2 registry and verifier references, the credential issuer role, distinct Phase 2 roles, constructor values, and the initial paused state.

## Future deployment, subject to separate authorization

No deployment command is authorized by this document. After the owner approves the addresses and parameters, the future Foundry command is:

```bash
cd contracts
forge script script/DeployRobinhoodDaoPhase2.s.sol:DeployRobinhoodDaoPhase2 \
  --profile robinhood_testnet \
  --rpc-url "$RH_TESTNET_RPC_URL" \
  --account <encrypted-deployer-alias> \
  --broadcast
```

After deployment, record only receipt-derived addresses in:

- `RH_TESTNET_PHASE2_REPUTATION_REGISTRY_ADDRESS`
- `RH_TESTNET_PHASE2_GOVERNANCE_ADDRESS`
- `NEXT_PUBLIC_ROBINHOOD_PHASE2_REPUTATION_REGISTRY_CONTRACT`
- `NEXT_PUBLIC_ROBINHOOD_PHASE2_GOVERNANCE_CONTRACT`

Confirm both bytecodes, dependencies, roles, parameters, and paused states before separately authorizing issuer setup or unpause operations. Do not treat simulation addresses as deployed addresses.
