import { explainProtocolError } from "@/lib/protocol/errors";

const RAW = /reverted with the following signature|ContractFunctionExecutionError|Unable to decode signature|Docs: https:\/\/viem\.sh|Version: viem|Request Arguments|Raw Call Arguments|Request body|RpcError|Double check you have provided/i;

/** The message the hooks stored, or an error, as one readable sentence: raw viem text never reaches the screen. */
export function explainGovernanceFailure(input: unknown): string {
  const text = typeof input === "string" ? input : explainProtocolError(input);
  return RAW.test(text) ? "The contract rejected this action, so nothing changed on-chain." : text;
}

/** For a read the user asked for (a receipt, a block range): the same clean sentence, with the likely cause of a rejected range. */
export function explainLookupFailure(input: unknown): string {
  const text = typeof input === "string" ? input : explainProtocolError(input);
  if (/InvalidParams|invalid parameters/i.test(text)) return "The RPC node rejected this request. If the last block is beyond the chain's latest block, lower it and try again.";
  return RAW.test(text) ? "The RPC node could not answer this request. Nothing was assumed; try again in a moment." : text;
}
