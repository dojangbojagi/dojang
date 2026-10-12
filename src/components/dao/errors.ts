import { explainProtocolError } from "@/lib/protocol/errors";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
import { ProtocolError } from "@/lib/protocol/types";

const RAW = /reverted with the following signature|ContractFunctionExecutionError|Unable to decode signature|Docs: https:\/\/viem\.sh|Version: viem|Request Arguments|Raw Call Arguments|Request body|RpcError|Double check you have provided/i;

/** The message the hooks stored, or an error, as one readable sentence: raw viem text never reaches the screen. */
export function explainGovernanceFailure(input: unknown, chainId: ProtocolChainId = GIWA_CHAIN_ID): string {
  const text = typeof input === "string" ? input : explainProtocolError(input);
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    const raw = typeof input === "string" ? input : input instanceof Error ? input.message : "";
    const lower = raw.toLowerCase();
    if (lower.includes("insufficient funds")) return "This wallet does not have enough Robinhood Testnet ETH to pay the network fee.";
    if (lower.includes("wrong network") || lower.includes("unsupportedchain")) return "Switch to Robinhood Chain Testnet (chain 46630) before using this DAO.";
    if (lower.includes("notverifiedmember")) return "An active DAO Governance project credential (policy 4) is required. This is not official Dojang verification.";
    if (input instanceof ProtocolError) return input.message;
    if (RAW.test(text)) return "The Robinhood governance contract rejected this action, so nothing changed on-chain.";
    return "Robinhood Testnet could not complete the governance RPC request. No successful state change was confirmed; refresh and try again.";
  }
  return RAW.test(text) ? "The contract rejected this action, so nothing changed on-chain." : text;
}

/** For a read the user asked for (a receipt, a block range): the same clean sentence, with the likely cause of a rejected range. */
export function explainLookupFailure(input: unknown): string {
  const text = typeof input === "string" ? input : explainProtocolError(input);
  if (/InvalidParams|invalid parameters/i.test(text)) return "The RPC node rejected this request. If the last block is beyond the chain's latest block, lower it and try again.";
  return RAW.test(text) ? "The RPC node could not answer this request. Nothing was assumed; try again in a moment." : text;
}
