import { keccak256, stringToBytes, zeroAddress, type Address, type PublicClient } from "viem";
import { controlledTestOracleAbi, controlledTokenAbi, credentialIssuerRoleAbi, credentialRegistryAbi, eligibilityVerifierAdapterAbi, lendingPoolV2Abi, robinhoodMainnetDemoMarkerAbi } from "../contracts/abis";
import { LENDING_V2_ELIGIBILITY_THRESHOLD, LENDING_V2_POLICY_ID, LENDING_V2_POLICY_VERSION, LENDING_V2_RAY } from "./v2-config";
import { GIWA_SEPOLIA_CHAIN_ID, type LendingV2ChainId } from "./v2-network";
import type { DemoCredentialRecord } from "../protocol/types";

const ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
const MAINNET_DEMO_ASSET_MARKER = keccak256(stringToBytes("ROBINHOOD_MAINNET_CONTROLLED_DEMO_ASSET_V1")).slice(0, 10);

export type LendingV2OracleState = "fresh" | "missing" | "stale" | "future" | "unavailable";
export type LendingV2MarketState =
  | "unconfigured"
  | "disconnected"
  | "wrong-network"
  | "checking"
  | "unavailable"
  | "read-error"
  | "ready";

export type LendingV2ReserveConfig = {
  supplyCap: bigint;
  borrowCap: bigint;
  collateralCap: bigint;
  minBorrowAmount: bigint;
  maxOracleAge: bigint;
  maxLtvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  closeFactorBps: number;
  reserveFactorBps: number;
  optimalUtilizationBps: number;
  baseBorrowRateBps: number;
  slope1Bps: number;
  slope2Bps: number;
  active: boolean;
  supplyEnabled: boolean;
  borrowEnabled: boolean;
  collateralEnabled: boolean;
};

export type LendingV2ReserveData = {
  decimals: number;
  liquidityIndex: bigint;
  borrowIndex: bigint;
  totalSupplyAssets: bigint;
  totalDebtAssets: bigint;
  availableLiquidity: bigint;
  utilizationBps: bigint;
  currentBorrowRateBps: bigint;
  currentSupplyRateBps: bigint;
  accruedProtocolFees: bigint;
  config: LendingV2ReserveConfig;
};

export type LendingV2Position = {
  supplied: bigint;
  collateral: bigint;
  debt: bigint;
  isCollateralEnabled: boolean;
  walletBalance: bigint;
  allowance: bigint;
  collateralValueWad?: bigint;
  debtValueWad?: bigint;
};

export type LendingV2AccountData = {
  collateralValueWad: bigint;
  ltvCapacityWad: bigint;
  liquidationValueWad: bigint;
  debtValueWad: bigint;
  currentLtvBps: bigint;
  healthFactorWad: bigint;
};

export type LendingV2ReserveSnapshot = {
  asset: Address;
  symbol: string;
  decimals: number;
  data: LendingV2ReserveData;
  oracle: {
    priceWad?: bigint;
    updatedAt?: bigint;
    state: LendingV2OracleState;
  };
  position?: LendingV2Position;
  maxBorrowable?: bigint;
};

export type LendingV2MarketSnapshot = {
  pool: Address;
  blockNumber: bigint;
  blockTimestamp: bigint;
  riskPaused: boolean;
  credentialRegistry: Address;
  eligibilityVerifier: Address;
  honkVerifier: Address;
  oracle: Address;
  policyId: bigint;
  policyVersion: bigint;
  threshold: bigint;
  reserves: LendingV2ReserveSnapshot[];
  position?: {
    wallet: Address;
    /** Present only for a wallet on the participant allowlist of the controlled Mainnet demo pool. */
    demoParticipant?: boolean;
    byAsset: Record<string, LendingV2Position>;
    account?: LendingV2AccountData;
    riskMetricsState: "available" | "blocked-by-oracle";
    liquidationEligible?: boolean;
  };
};

export type LendingV2CredentialSnapshot = {
  state: "missing" | "active" | "expired" | "revoked" | "not-yet-valid" | "issuer-untrusted";
  record?: DemoCredentialRecord;
  issuerAuthorized: boolean;
};

export class LendingV2UnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LendingV2UnavailableError";
  }
}

export class LendingV2WrongNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LendingV2WrongNetworkError";
  }
}

export function lendingV2OracleState(input: {
  priceWad: bigint;
  updatedAt: bigint;
  maxAge: bigint;
  now: bigint;
}): LendingV2OracleState {
  if (input.priceWad === 0n || input.updatedAt === 0n) return "missing";
  if (input.updatedAt > input.now) return "future";
  if (input.now - input.updatedAt > input.maxAge) return "stale";
  return "fresh";
}

export function effectiveLendingV2MaxBorrowable(input: {
  ltvCapacity: bigint;
  availableLiquidity: bigint;
  borrowCap: bigint;
  totalDebt: bigint;
  borrowEnabled: boolean;
}): bigint {
  if (!input.borrowEnabled) return 0n;
  const capHeadroom = input.borrowCap > input.totalDebt ? input.borrowCap - input.totalDebt : 0n;
  return [input.ltvCapacity, input.availableLiquidity, capHeadroom].reduce((minimum, value) =>
    value < minimum ? value : minimum,
  );
}

function codeExists(code: `0x${string}` | undefined): boolean {
  return Boolean(code && code !== "0x");
}

export async function readLendingV2Deployment(
  client: PublicClient,
  pool: Address,
  expectedRegistry?: Address,
  readAtBlock?: bigint,
  expectedChainId: LendingV2ChainId = GIWA_SEPOLIA_CHAIN_ID,
  expectedVerifier?: Address,
  expectedOracle?: Address,
  expectedHonkVerifier?: Address,
  expectedAssets?: readonly Address[],
): Promise<{
  pool: Address;
  credentialRegistry: Address;
  eligibilityVerifier: Address;
  honkVerifier: Address;
  oracle: Address;
  policyId: bigint;
  policyVersion: bigint;
  threshold: bigint;
}> {
  const block = readAtBlock === undefined ? await client.getBlock({ blockTag: "latest" }) : undefined;
  const blockNumber = readAtBlock ?? block!.number;
  const actualChainId = await client.getChainId();
  if (actualChainId !== expectedChainId) {
    throw new LendingV2WrongNetworkError(
      `The configured RPC reports chain ${actualChainId}; expected chain ${expectedChainId}.`,
    );
  }
  if (!codeExists(await client.getCode({ address: pool, blockNumber }))) {
    throw new LendingV2UnavailableError("No contract bytecode is deployed at the configured V2 pool address.");
  }

  const [policyId, policyVersion, threshold, credentialRegistry, eligibilityVerifier, oracle] = await Promise.all([
    client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "POLICY_ID", blockNumber }),
    client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "POLICY_VERSION", blockNumber }),
    client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "ELIGIBILITY_THRESHOLD", blockNumber }),
    client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "credentialRegistry", blockNumber }),
    client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "eligibilityVerifier", blockNumber }),
    client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "priceOracle", blockNumber }),
  ]);
  if (
    policyId !== LENDING_V2_POLICY_ID || policyVersion !== LENDING_V2_POLICY_VERSION ||
    threshold !== LENDING_V2_ELIGIBILITY_THRESHOLD
  ) {
    throw new LendingV2UnavailableError("The configured contract does not expose the expected Lending V2 policy constants.");
  }
  if (expectedRegistry && expectedRegistry.toLowerCase() !== credentialRegistry.toLowerCase()) {
    throw new LendingV2UnavailableError("The V2 pool credential registry does not match the configured project registry.");
  }
  if (expectedVerifier && expectedVerifier.toLowerCase() !== eligibilityVerifier.toLowerCase()) {
    throw new LendingV2UnavailableError("The V2 pool verifier adapter does not match the configured project verifier adapter.");
  }
  if (expectedOracle && expectedOracle.toLowerCase() !== oracle.toLowerCase()) {
    throw new LendingV2UnavailableError("The V2 pool oracle does not match the configured project oracle.");
  }
  const [registryCode, verifierCode, oracleCode] = await Promise.all([
    client.getCode({ address: credentialRegistry, blockNumber }),
    client.getCode({ address: eligibilityVerifier, blockNumber }),
    client.getCode({ address: oracle, blockNumber }),
  ]);
  if (!codeExists(registryCode) || !codeExists(verifierCode) || !codeExists(oracleCode)) {
    throw new LendingV2UnavailableError("The V2 pool references a registry, verifier adapter, or oracle without deployed bytecode.");
  }
  const honkVerifier = await client.readContract({
    address: eligibilityVerifier,
    abi: eligibilityVerifierAdapterAbi,
    functionName: "honkVerifier",
    blockNumber,
  });
  if (expectedHonkVerifier && expectedHonkVerifier.toLowerCase() !== honkVerifier.toLowerCase()) {
    throw new LendingV2UnavailableError("The verifier adapter does not link to the configured HonkVerifier.");
  }
  const honkVerifierCode = await client.getCode({ address: honkVerifier, blockNumber });
  if (!codeExists(honkVerifierCode)) {
    throw new LendingV2UnavailableError("The verifier adapter references a HonkVerifier without deployed bytecode.");
  }
  if (expectedChainId === ROBINHOOD_MAINNET_CHAIN_ID) {
    if (!expectedAssets || expectedAssets.length !== 2) {
      throw new LendingV2UnavailableError("Robinhood Mainnet Lending requires the two receipt-confirmed synthetic demo token addresses.");
    }
    const [demoOnly, loanAsset, collateralAsset, registryDemoOnly] = await Promise.all([
      client.readContract({ address: pool, abi: robinhoodMainnetDemoMarkerAbi, functionName: "demoOnly", blockNumber }),
      client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "demoLoanAsset", blockNumber }),
      client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "demoCollateralAsset", blockNumber }),
      client.readContract({ address: credentialRegistry, abi: robinhoodMainnetDemoMarkerAbi, functionName: "demoOnly", blockNumber }),
    ]);
    if (!demoOnly || !registryDemoOnly) {
      throw new LendingV2UnavailableError("The Mainnet pool and credential registry must expose their controlled-demo markers.");
    }
    const expectedSet = new Set(expectedAssets.map((asset) => asset.toLowerCase()));
    if (expectedSet.size !== 2 || !expectedSet.has(loanAsset.toLowerCase()) || !expectedSet.has(collateralAsset.toLowerCase()) || loanAsset.toLowerCase() === collateralAsset.toLowerCase()) {
      throw new LendingV2UnavailableError("The Mainnet pool's immutable demo token addresses do not match the separate Mainnet registry.");
    }
    const markers = await Promise.all(expectedAssets.map(async (asset) => {
      const [assetDemoOnly, marker, mintCap] = await Promise.all([
        client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "demoOnly", blockNumber }),
        client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "controlledDemoAssetMarker", blockNumber }),
        client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "mintCap", blockNumber }),
      ]);
      return assetDemoOnly && marker.toLowerCase() === MAINNET_DEMO_ASSET_MARKER.toLowerCase() && mintCap > 0n;
    }));
    if (markers.some((valid) => !valid)) {
      throw new LendingV2UnavailableError("A configured Mainnet reserve token is not marked as a capped synthetic demo asset.");
    }
  }
  return { pool, credentialRegistry, eligibilityVerifier, honkVerifier, oracle, policyId, policyVersion, threshold };
}

export async function readLendingV2Credential(
  client: PublicClient,
  registry: Address,
  wallet: Address,
): Promise<LendingV2CredentialSnapshot> {
  const block = await client.getBlock({ blockTag: "latest" });
  const [raw, role] = await Promise.all([
    client.readContract({ address: registry, abi: credentialRegistryAbi, functionName: "getCredential", args: [wallet, LENDING_V2_POLICY_ID], blockNumber: block.number }),
    client.readContract({ address: registry, abi: credentialIssuerRoleAbi, functionName: "ISSUER_ROLE", blockNumber: block.number }),
  ]);
  if (!raw || raw.wallet.toLowerCase() === zeroAddress) {
    return { state: "missing", issuerAuthorized: false };
  }
  const record: DemoCredentialRecord = {
    wallet: raw.wallet,
    commitment: raw.commitment,
    issuer: raw.issuer,
    issuedAt: raw.issuedAt,
    expiresAt: raw.expiresAt,
    version: raw.version,
    revoked: raw.revoked,
  };
  const issuerAuthorized = await client.readContract({
    address: registry,
    abi: credentialIssuerRoleAbi,
    functionName: "hasRole",
    args: [role, record.issuer],
    blockNumber: block.number,
  });
  const state = record.revoked
    ? "revoked"
    : record.issuedAt > block.timestamp
      ? "not-yet-valid"
      : record.expiresAt <= block.timestamp
        ? "expired"
        : !issuerAuthorized
          ? "issuer-untrusted"
          : "active";
  return { state, record, issuerAuthorized };
}

export async function readLendingV2Market(
  client: PublicClient,
  input: {
    pool: Address;
    wallet?: Address;
    expectedRegistry?: Address;
    expectedChainId?: LendingV2ChainId;
    expectedVerifier?: Address;
    expectedOracle?: Address;
    expectedHonkVerifier?: Address;
    expectedAssets?: readonly Address[];
  },
): Promise<LendingV2MarketSnapshot> {
  const block = await client.getBlock({ blockTag: "latest" });
  const deployment = await readLendingV2Deployment(
    client,
    input.pool,
    input.expectedRegistry,
    block.number,
    input.expectedChainId,
    input.expectedVerifier,
    input.expectedOracle,
    input.expectedHonkVerifier,
    input.expectedAssets,
  );
  const [assets, riskPaused] = await Promise.all([
    client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "getReserveAssets", blockNumber: block.number }),
    client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "paused", blockNumber: block.number }),
  ]);
  const demoParticipant = input.expectedChainId === ROBINHOOD_MAINNET_CHAIN_ID && input.wallet
    ? await client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "isDemoParticipant", args: [input.wallet], blockNumber: block.number })
    : undefined;
  const reserveCount = await client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "reserveCount", blockNumber: block.number });
  if (reserveCount !== BigInt(assets.length) || assets.length > 8 || new Set(assets.map((asset) => asset.toLowerCase())).size !== assets.length) {
    throw new LendingV2UnavailableError("The pool reserve count and reserve list are inconsistent.");
  }
  if (input.expectedAssets) {
    const actualAssets = new Set(assets.map((asset) => asset.toLowerCase()));
    const configuredAssets = new Set(input.expectedAssets.map((asset) => asset.toLowerCase()));
    if (configuredAssets.size !== input.expectedAssets.length || actualAssets.size !== configuredAssets.size ||
      [...actualAssets].some((asset) => !configuredAssets.has(asset))) {
      throw new LendingV2UnavailableError("The Robinhood pool reserve list does not match the configured project test assets.");
    }
  }

  const reserves = await Promise.all(assets.map(async (asset): Promise<LendingV2ReserveSnapshot> => {
    const [rawData, config, symbol, tokenDecimals, availableLiquidity, priceRead, positionResult] = await Promise.all([
      client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "getReserveData", args: [asset], blockNumber: block.number }),
      client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "getReserveConfig", args: [asset], blockNumber: block.number }),
      client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "symbol", blockNumber: block.number }),
      client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "decimals", blockNumber: block.number }),
      client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "availableLiquidity", args: [asset], blockNumber: block.number }),
      client.readContract({ address: deployment.oracle, abi: controlledTestOracleAbi, functionName: "getPrice", args: [asset], blockNumber: block.number })
        .then((value) => ({ value, failed: false as const }))
        .catch(() => ({ value: undefined, failed: true as const })),
      input.wallet
        ? Promise.all([
            client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [input.wallet, asset], blockNumber: block.number }),
            client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "balanceOf", args: [input.wallet], blockNumber: block.number }),
            client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "allowance", args: [input.wallet, input.pool], blockNumber: block.number }),
          ])
        : Promise.resolve(undefined),
    ]);

    const configMatches = (Object.keys(config) as Array<keyof LendingV2ReserveConfig>)
      .every((key) => rawData.config[key] === config[key]);
    if (tokenDecimals !== rawData.decimals || !configMatches || availableLiquidity !== rawData.availableLiquidity) {
      throw new LendingV2UnavailableError(`Reserve views or token decimals disagree for ${asset}.`);
    }
    const priceWad = priceRead.value?.[0];
    const updatedAt = priceRead.value?.[1];
    const oracleState = priceRead.failed || priceWad === undefined || updatedAt === undefined
      ? "unavailable"
      : lendingV2OracleState({ priceWad, updatedAt, maxAge: rawData.config.maxOracleAge, now: block.timestamp });
    const positionValues = positionResult?.[0];
    const position = positionValues
      ? {
          supplied: positionValues[0],
          collateral: positionValues[1],
          debt: positionValues[2],
          isCollateralEnabled: positionValues[3],
          walletBalance: positionResult[1],
          allowance: positionResult[2],
          collateralValueWad: oracleState === "fresh" && priceWad !== undefined && positionValues[3]
            ? positionValues[1] * priceWad / (10n ** BigInt(tokenDecimals))
            : undefined,
          debtValueWad: oracleState === "fresh" && priceWad !== undefined && positionValues[2] > 0n
            ? (positionValues[2] * priceWad + (10n ** BigInt(tokenDecimals)) - 1n) / (10n ** BigInt(tokenDecimals))
            : undefined,
        }
      : undefined;
    const data: LendingV2ReserveData = {
      decimals: rawData.decimals,
      liquidityIndex: rawData.liquidityIndex,
      borrowIndex: rawData.borrowIndex,
      totalSupplyAssets: rawData.totalSupplyAssets,
      totalDebtAssets: rawData.totalDebtAssets,
      availableLiquidity,
      utilizationBps: rawData.utilizationBps,
      currentBorrowRateBps: rawData.currentBorrowRateBps,
      currentSupplyRateBps: rawData.currentSupplyRateBps,
      accruedProtocolFees: rawData.accruedProtocolFees,
      config: rawData.config,
    };
    return { asset, symbol, decimals: Number(tokenDecimals), data, oracle: { priceWad, updatedAt, state: oracleState }, position };
  }));

  if (!input.wallet) {
    return { ...deployment, blockNumber: block.number, blockTimestamp: block.timestamp, riskPaused, reserves };
  }

  const byAsset = Object.fromEntries(reserves.map((reserve) => [reserve.asset.toLowerCase(), reserve.position!])) as Record<string, LendingV2Position>;
  const requiresFreshPrice = reserves.some(({ position, oracle }) => Boolean(
    position && ((position.isCollateralEnabled && position.collateral > 0n) || position.debt > 0n) && oracle.state !== "fresh",
  ));
  const account = requiresFreshPrice
    ? undefined
    : await client.readContract({ address: input.pool, abi: lendingPoolV2Abi, functionName: "getAccountData", args: [input.wallet], blockNumber: block.number });
  const riskMetricsState = requiresFreshPrice ? "blocked-by-oracle" as const : "available" as const;

  const reservesWithMax = await Promise.all(reserves.map(async (reserve) => {
    if (reserve.oracle.state !== "fresh" || !account) return reserve;
    const ltvBorrowable = await client.readContract({
      address: input.pool,
      abi: lendingPoolV2Abi,
      functionName: "getMaxBorrowable",
      args: [input.wallet!, reserve.asset],
      blockNumber: block.number,
    });
    const maxBorrowable = effectiveLendingV2MaxBorrowable({
      ltvCapacity: ltvBorrowable,
      availableLiquidity: reserve.data.availableLiquidity,
      borrowCap: reserve.data.config.borrowCap,
      totalDebt: reserve.data.totalDebtAssets,
      borrowEnabled: !riskPaused && reserve.data.config.active && reserve.data.config.borrowEnabled,
    });
    return { ...reserve, maxBorrowable };
  }));

  const debtValueWad = account?.debtValueWad;
  return {
    ...deployment,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    riskPaused,
    reserves: reservesWithMax,
    position: {
      wallet: input.wallet,
      demoParticipant,
      byAsset,
      account: account ? {
        collateralValueWad: account.collateralValueWad,
        ltvCapacityWad: account.ltvCapacityWad,
        liquidationValueWad: account.liquidationValueWad,
        debtValueWad: account.debtValueWad,
        currentLtvBps: account.currentLtvBps,
        healthFactorWad: account.healthFactorWad,
      } : undefined,
      riskMetricsState,
      liquidationEligible: account && debtValueWad !== undefined && debtValueWad > 0n
        ? account.healthFactorWad < LENDING_V2_RAY
        : undefined,
    },
  };
}
