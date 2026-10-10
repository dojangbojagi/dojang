# DAO Governance Architecture

## Status

- Governance contract and frontend adapter are implemented in this repository.
- The lifecycle has Foundry coverage using isolated Dojang/EAS-compatible fixtures.
- `bun run governance:anvil` also completed a local-only Anvil lifecycle with mined deployment, proposal, vote, finalization, access, and execution receipts.
- The standard GIWA Sepolia deployment script binds to the official Dojang contracts and does not accept demo-registry addresses.
- Governance has **not** been deployed to GIWA Sepolia. No testnet address, receipt, positive live attestation read, or verified source is claimed.
- The test fixtures are local-only contract doubles. They are not official Dojang and cannot be used by the standard deployment script.

## Protocol boundaries

| System | Ownership and purpose |
| --- | --- |
| GIWA Sepolia | External EVM execution network, chain ID `91342`. |
| DojangScroll, DojangAttesterBook, EAS | Official external Dojang/EAS verification infrastructure. |
| Bojagi-inspired ZK | Existing project privacy reference and proof layer. Governance does not claim private or anonymous voting. |
| `GovernedDojangAccess` | Project-owned membership governance and a narrowly scoped governed access policy. |
| `RestrictedVault` | Existing project-owned proof-gated access flag. Its proof threshold and proof domain are unchanged. |
| `LendingPool` | Existing project-owned demo lending utility. Its risk parameters and proof domain are unchanged. |

The governance MVP does not use the demo credential registry, an ERC-20 voting token, treasury custody, or arbitrary target execution. One wallet receives one vote per proposal. This does not guarantee one person per vote; one person may control multiple eligible wallets.

## Official Dojang boundary

The standard deployment configuration uses GIWA's documented GIWA Sepolia addresses and values:

- DojangScroll: `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9`
- DojangAttesterBook: `0xDA282E89244424E297Ce8e78089B54D043FB28B6`
- EAS: `0x4200000000000000000000000000000000000021`
- Upbit Korea attester ID: `0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034`
- Verified Address schema UID: `0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08`

The attester address is resolved from `DojangAttesterBook.getAttester(attesterId)` at read time. A read-only GIWA Sepolia check at block `38,306,947` (`2026-10-10T17:07:43Z`) returned `0x09B170CA2A006081042992bCE7379B85a02149C6`. GIWA's published table lists `0x4097bF3Cb731AEB3E501b910B33B2aF9Fa68E38` (padded to 20 bytes as `0x04097bf3Cb731AEb3e501b910b33B2Af9Fa68E38`), so the published value and observed live mapping differ. The on-chain book is authoritative; consumers must resolve it dynamically. The integration does not require the attester address to contain bytecode.

Membership is accepted only when all checks pass:

1. `DojangScroll.isVerified(wallet, attesterId)` returns true.
2. DojangScroll returns a nonzero Verified Address attestation UID.
3. EAS returns the same UID, the configured Verified Address schema UID, and the requested wallet as recipient.
4. The EAS attester matches `DojangAttesterBook.getAttester(attesterId)`.
5. `EAS.isAttestationValid(uid)` is true, the revocation timestamp is zero, the attestation is not expired or future-dated, and its ABI-encoded `bool isVerified` data is true.

The official Dojang tutorial documents `isVerified` and the UID lookup; EAS provides attestation metadata such as expiration. See [GIWA Verified Address](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/verified-address), [GIWA Dojang contracts](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts), and the [official Dojang source repository](https://github.com/giwa-io/dojang).

If any official RPC read fails, the contract reverts and grants no membership or access. The app also reads the attester book dynamically. No project-issued credential can satisfy this official Dojang path.

## Membership timing and voting

- Membership is checked when a wallet creates a proposal and again when it casts a vote.
- Proposal creation enters `Pending` for one minute. Voting then remains open for the constructor-configured `votingPeriod`.
- The deadline is exclusive: votes at or after the deadline revert.
- Each wallet may cast exactly one `For`, `Against`, or `Abstain` vote per proposal.
- Quorum is an absolute number of wallets. For/Against/Abstain each count toward quorum; approval requires `forVotes > againstVotes`.
- Anyone may finalize after the deadline. A proposal below quorum or without a For majority is `Rejected`.
- A successful proposal must be executed before its constructor-configured execution window closes. Otherwise it becomes `Expired`.
- A successful vote is not a membership snapshot. A wallet revoked after its vote does not erase that already recorded vote; every later proposal or vote checks current status.
- Finalization and execution are permissionless after their respective lifecycle conditions. They do not require the caller to be a member.

## The only governance action

Every proposal may change only `minimumRemainingValidity`, the number of seconds an official Dojang attestation must remain valid before `performProtectedAction()` accepts it. The value is bounded to `0..365 days`. The action always targets this contract and always uses its single internal `applyGovernanceAction` selector; proposal input cannot choose a target or arbitrary calldata.

`performProtectedAction()` rechecks the current official Dojang attestation, applies the governed remaining-validity requirement, increments that wallet's on-chain action count, and emits `ProtectedActionPerformed`. An approved proposal therefore changes a value consumed by a protected protocol function. A value of zero still requires current official Dojang verification; governance cannot remove that gate.

The action is deliberately separate from `RestrictedVault` because the vault's fixed eligibility threshold is bound into the existing ZK circuit's public inputs. Governance does not modify or invalidate that circuit, the vault policy, or the lending proof domain. It also cannot mint assets, transfer funds, modify lending risk parameters, or execute arbitrary calls.

## Contract lifecycle and states

`GovernedDojangAccess` exposes `createProposal`, `castVote`, `finalizeProposal`, `executeProposal`, `proposalState`, `getProposal`, `proposalVoteCounts`, `proposalTiming`, `hasVoted`, and `isVerifiedMember`.

`ProposalState` numeric ABI values are:

| Value | State | Meaning |
| ---: | --- | --- |
| 0 | `None` | Not a stored proposal; read methods revert for unknown IDs. |
| 1 | `Pending` | Created, but the one-minute start delay has not elapsed. |
| 2 | `Active` | Voting is open. |
| 3 | `Succeeded` | Voting ended, quorum and For majority passed, execution window is open. |
| 4 | `Rejected` | Quorum or approval rule failed. |
| 5 | `Expired` | Successful proposal was not executed in time. |
| 6 | `Executed` | The allowlisted policy update executed. |

## Deployment and verification

Use `contracts/script/DeployGovernanceGIWASepolia.s.sol` after confirming official Dojang code exists on GIWA Sepolia. The script binds fixed official Dojang constants and reads these values from the deployment environment:

- `GIWA_ADMIN_ADDRESS`: address used as the deployment sender; no private key is read by the script.
- `GIWA_GOVERNANCE_VOTING_PERIOD`: seconds, at least one hour for the standard deployment script and no more than 30 days at contract level.
- `GIWA_GOVERNANCE_QUORUM`: absolute vote count, greater than zero.
- `GIWA_GOVERNANCE_EXECUTION_WINDOW`: seconds, no more than 90 days.
- `GIWA_GOVERNANCE_INITIAL_MIN_VALIDITY`: seconds, no more than 365 days.
- `NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT`: set in the application environment only after real deployment and address readback.

The script simulates by default. Deployment requires explicit `--broadcast` authorization in a later deployment task. After deployment, record the chain ID, constructor values, transaction hash, receipt status, creation bytecode verification, dependency getter readback, current attester-book mapping, and the Blockscout source-verification result. Do not use fixture addresses or local Anvil receipts as testnet deployment evidence.

## Local test evidence and limits

`contracts/test/Governance.t.sol` covers verified and unverified membership, revocation and expiration, metadata mismatch, start/deadline checks, one-vote enforcement, quorum, rejection, finalization, expiration, authorization, repeated execution, and policy enforcement before and after execution.

The Anvil receipt run used only test fixtures on local chain ID `91342`. It reached `Executed`, changed `minimumRemainingValidity` to `172800` seconds, confirmed a protected action before the change, and rejected a later protected action with the one-day fixture credential. These are local receipts, not GIWA Sepolia evidence.

The fixtures model only the documented external read boundary. They do not establish that a positive Upbit Korea attestation is currently readable on GIWA Sepolia. Live RPC availability and a credentialed test wallet remain deployment preflight requirements.
