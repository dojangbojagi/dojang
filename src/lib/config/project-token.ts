import type { Address } from "viem";

export type ProjectTokenConfig = Readonly<{
  address: Address | undefined;
  chainId: number | undefined;
}>;

// Set these only after the project token address and its network are confirmed.
export const projectTokenConfig: ProjectTokenConfig = {
  address: undefined,
  chainId: undefined,
};
