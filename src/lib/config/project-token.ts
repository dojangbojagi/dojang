import type { Address } from "viem";

export type ProjectTokenConfig = Readonly<{
  address: Address | undefined;
  chainId: number | undefined;
}>;

// The address is supplied for the landing CA display; add a chain ID only when confirmed.
export const projectTokenConfig: ProjectTokenConfig = {
  address: "0xae82c2e2dbb71ffe27d2115406dab84b91bc806f",
  chainId: undefined,
};
