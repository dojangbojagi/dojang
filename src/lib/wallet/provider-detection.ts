export type ExplicitEvmWallet = "metaMask" | "rabby";

export function isWalletChainVerified(input: {
  connected: boolean;
  accountChainId?: number;
  providerChainId?: number;
  expectedChainId: number;
}): boolean {
  return input.connected &&
    input.accountChainId !== undefined &&
    input.providerChainId !== undefined &&
    input.accountChainId === input.providerChainId &&
    input.providerChainId === input.expectedChainId;
}

type WalletProvider = Record<string, unknown>;
type EthereumNamespace = WalletProvider & { providers?: readonly WalletProvider[] };

const META_MASK_IMPERSONATOR_FLAGS = [
  "isApexWallet",
  "isAvalanche",
  "isBitKeep",
  "isBlockWallet",
  "isKuCoinWallet",
  "isMathWallet",
  "isOkxWallet",
  "isOKExWallet",
  "isOneInchIOSWallet",
  "isOneInchAndroidWallet",
  "isOpera",
  "isPhantom",
  "isPortal",
  "isRabby",
  "isTokenPocket",
  "isTokenary",
  "isUniswapWallet",
  "isZerion",
] as const;

/** Read-only provider identity check for showing an explicit wallet choice as installed. */
export function isExplicitEvmWalletProvider(wallet: ExplicitEvmWallet, candidate: unknown): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const provider = candidate as WalletProvider;

  if (wallet === "rabby") return provider.isRabby === true;
  if (provider.isMetaMask !== true) return false;
  return !META_MASK_IMPERSONATOR_FLAGS.some((flag) => provider[flag] === true);
}

/** Checks the selected extension among an injected provider and its EIP-1193 provider array. */
export function hasExplicitEvmWalletProvider(wallet: ExplicitEvmWallet, namespace: unknown): boolean {
  if (!namespace || typeof namespace !== "object") return false;
  const ethereum = namespace as EthereumNamespace;
  const providers = ethereum.providers?.length ? ethereum.providers : [ethereum];
  return providers.some((provider) => isExplicitEvmWalletProvider(wallet, provider));
}
