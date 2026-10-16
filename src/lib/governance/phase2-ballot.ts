import { isAddress } from "viem";
import type { Phase2BallotSecret } from "@/lib/governance/phase2-types";

export function parsePhase2Ballot(value: unknown, expectedChainId: number): Phase2BallotSecret {
  if (!value || typeof value !== "object") throw new Error("The ballot reveal file is not a JSON object.");
  if (expectedChainId !== 4_663 && expectedChainId !== 46_630) {
    throw new Error("DAO Phase 2 ballots are supported only on Robinhood Mainnet or Testnet.");
  }
  const candidate = value as Partial<Phase2BallotSecret>;
  if (
    candidate.format !== "gyevo-dao-phase2-ballot-v1" || candidate.chainId !== expectedChainId
      || !candidate.governance || !isAddress(candidate.governance)
      || !candidate.voter || !isAddress(candidate.voter)
      || typeof candidate.proposalId !== "string" || !/^[1-9][0-9]*$/.test(candidate.proposalId)
      || ![0, 1, 2].includes(candidate.voteType as number)
      || !candidate.salt || !/^0x[0-9a-fA-F]{64}$/.test(candidate.salt)
      || !candidate.commitment || !/^0x[0-9a-fA-F]{64}$/.test(candidate.commitment)
      || !candidate.nullifier || !/^0x[0-9a-fA-F]{64}$/.test(candidate.nullifier)
  ) throw new Error("The ballot reveal file is incomplete, invalid, or belongs to a different chain.");
  return candidate as Phase2BallotSecret;
}
