import {
  createPublicClient,
  formatEther,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "../src/lib/config/chain";
import { officialDojang } from "../src/lib/config/contracts";
import { appEnv } from "../src/lib/config/env";

export { GIWA_EXPLORER_URL };
export const GIWA_SEPOLIA_CHAIN_ID = GIWA_CHAIN_ID;

export type ContractStatus =
  | "NOT CONFIGURED"
  | "NOT DEPLOYED"
  | "CODE PRESENT"
  | "DEPLOYED / RECEIPT CONFIRMED"
  | "SOURCE VERIFIED"
  | "BLOCKED"
  | "ERROR"
  | "NOT A DEPLOYMENT TARGET";

export type RpcStatus = "AVAILABLE" | "NOT CONFIGURED" | "UNAVAILABLE" | "WRONG CHAIN";
export type VerificationStatus = "SOURCE VERIFIED" | "NOT VERIFIED" | "UNKNOWN";

export interface DeployEnvironment {
  [key: string]: string | undefined;
}

export interface RpcClient {
  getChainId(): Promise<number>;
  getBlock(args: { blockTag: "latest" }): Promise<{ number: bigint | null }>;
  getBalance(args: { address: Address }): Promise<bigint>;
  getBytecode(args: { address: Address }): Promise<Hex | undefined>;
  getTransactionReceipt(args: { hash: Hex }): Promise<{
    status: "success" | "reverted";
    transactionHash: Hex;
    blockNumber: bigint;
    contractAddress: Address | null;
  }>;
}

export interface BroadcastDeployment {
  chainId: number | null;
  artifactPath: string;
  contractName: string;
  contractAddress: Address;
  transactionHash: Hex;
}

export interface ConfirmedDeployment extends BroadcastDeployment {
  blockNumber: bigint;
  explorerTransactionUrl: string;
  explorerContractUrl: string;
}

export interface ContractEvidence {
  name: string;
  status: ContractStatus;
  address?: Address;
  external?: boolean;
  dependencies: string[];
  missingDependencies: string[];
  bytecodePresent?: boolean;
  verification?: VerificationStatus;
  explorerUrl?: string;
  receipt?: ConfirmedDeployment;
  note?: string;
}

export interface DeploymentReport {
  brand: string;
  theme: AsciiTheme;
  rpcUrlConfigured: boolean;
  rpcStatus: RpcStatus;
  actualChainId?: number;
  latestBlock?: bigint;
  rpcError?: string;
  signerAddress?: Address;
  signerStatus: "CONFIGURED" | "NOT CONFIGURED" | "ERROR";
  signerBalance?: bigint;
  contracts: ContractEvidence[];
  confirmedDeployments: ConfirmedDeployment[];
  localArtifactCount: number;
  unclassifiedArtifactCount: number;
  giwaCandidateCount: number;
  configurationErrors: string[];
}

export type AsciiTheme = "lime" | "ice" | "mono";

export interface BroadcastScan {
  deployments: BroadcastDeployment[];
  localArtifactCount: number;
  unclassifiedArtifactCount: number;
  giwaCandidateCount: number;
}

export interface CollectOptions {
  env?: DeployEnvironment;
  cwd?: string;
  createClient?: (rpcUrl: string) => RpcClient;
  fetcher?: typeof fetch;
}

const DEFAULT_COLUMNS = 80;
const NAME_MAX_LENGTH = 30;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const GLYPHS: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
};

const THEME_ANSI: Record<AsciiTheme, Record<string, string>> = {
  lime: { accent: "\u001b[92m", info: "\u001b[96m", muted: "\u001b[90m", warning: "\u001b[93m", error: "\u001b[91m", reset: "\u001b[0m" },
  ice: { accent: "\u001b[96m", info: "\u001b[94m", muted: "\u001b[90m", warning: "\u001b[93m", error: "\u001b[91m", reset: "\u001b[0m" },
  mono: { accent: "\u001b[97m", info: "\u001b[37m", muted: "\u001b[90m", warning: "\u001b[97m", error: "\u001b[97m", reset: "\u001b[0m" },
};

interface ContractDefinition {
  name: string;
  addressEnv: string[];
  artifactNames: string[];
  dependencies?: string[];
  external?: boolean;
  note?: string;
}

const CONTRACT_DEFINITIONS: ContractDefinition[] = [
  { name: "HonkVerifier", addressEnv: ["GIWA_HONK_VERIFIER_ADDRESS"], artifactNames: ["HonkVerifier"], dependencies: ["ZK transcript library", "Relations library"] },
  { name: "ZK transcript library", addressEnv: ["GIWA_ZK_TRANSCRIPT_LIB_ADDRESS"], artifactNames: ["TranscriptLib", "ZKTranscriptLib", "TranscriptLibrary"] },
  { name: "Relations library", addressEnv: ["GIWA_RELATIONS_LIB_ADDRESS"], artifactNames: ["RelationsLib", "RelationsLibrary"] },
  { name: "DemoCredentialRegistry", addressEnv: ["GIWA_CREDENTIAL_REGISTRY_ADDRESS", "NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT"], artifactNames: ["DemoCredentialRegistry"] },
  { name: "EligibilityVerifierAdapter", addressEnv: ["GIWA_VERIFIER_ADAPTER_ADDRESS", "NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT"], artifactNames: ["EligibilityVerifierAdapter"], dependencies: ["HonkVerifier"] },
  { name: "GovernedDojangAccess", addressEnv: ["GIWA_DAO_GOVERNANCE_ADDRESS", "NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT"], artifactNames: ["GovernedDojangAccess"], dependencies: ["DojangScroll (official external)", "DojangAttesterBook (official external)", "EAS (official external)"] },
  { name: "LendingPoolV2", addressEnv: ["GIWA_LENDING_V2_POOL_ADDRESS", "NEXT_PUBLIC_LENDING_V2_POOL_CONTRACT"], artifactNames: ["LendingPoolV2"], dependencies: ["DemoCredentialRegistry", "EligibilityVerifierAdapter", "ControlledTestOracle", "GIWA_ADMIN_ADDRESS", "GIWA_ISSUER_ADDRESS"] },
  { name: "ControlledTestOracle", addressEnv: ["GIWA_LENDING_V2_ORACLE_ADDRESS"], artifactNames: ["ControlledTestOracle"], dependencies: ["GIWA_ADMIN_ADDRESS"] },
  { name: "V2 demo lending asset", addressEnv: ["GIWA_LENDING_V2_ASSET_ADDRESS"], artifactNames: [], dependencies: ["LendingPoolV2 deployment script"] },
  { name: "V2 demo collateral asset", addressEnv: ["GIWA_LENDING_V2_COLLATERAL_ADDRESS"], artifactNames: [], dependencies: ["LendingPoolV2 deployment script"] },
  { name: "Legacy LendingPool", addressEnv: ["GIWA_LENDING_POOL_ADDRESS", "NEXT_PUBLIC_LENDING_POOL_CONTRACT"], artifactNames: ["LendingPool"], dependencies: ["DemoCredentialRegistry", "EligibilityVerifierAdapter", "GIWA_LENDING_ASSET_ADDRESS", "GIWA_COLLATERAL_ASSET_ADDRESS"] },
  { name: "Legacy lending asset", addressEnv: ["GIWA_LENDING_ASSET_ADDRESS"], artifactNames: ["ControlledTestToken"], dependencies: ["GIWA_ADMIN_ADDRESS"] },
  { name: "Legacy collateral asset", addressEnv: ["GIWA_COLLATERAL_ASSET_ADDRESS"], artifactNames: ["ControlledTestToken"], dependencies: ["GIWA_ADMIN_ADDRESS"] },
  { name: "RestrictedVault", addressEnv: ["GIWA_RESTRICTED_VAULT_ADDRESS", "NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT"], artifactNames: ["RestrictedVault"], dependencies: ["DemoCredentialRegistry", "EligibilityVerifierAdapter"] },
  { name: "DojangScroll (official external)", addressEnv: [], artifactNames: [], external: true, note: "Official GIWA attestation infrastructure; not project-owned." },
  { name: "DojangAttesterBook (official external)", addressEnv: [], artifactNames: [], external: true, note: "Official GIWA attestation infrastructure; not project-owned." },
  { name: "EAS (official external)", addressEnv: [], artifactNames: [], external: true, note: "External attestation infrastructure; not project-owned." },
  { name: "UtilizationRateModel", addressEnv: [], artifactNames: [], note: "Internal Solidity library compiled into LendingPoolV2; it has no separate deployment address." },
];

const OFFICIAL_EXTERNAL_ADDRESSES: Record<string, Address> = {
  "DojangScroll (official external)": officialDojang.dojangScroll,
  "DojangAttesterBook (official external)": officialDojang.dojangAttesterBook,
  "EAS (official external)": officialDojang.eas,
};

function valueFrom(env: DeployEnvironment, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function sanitizeBrand(value: string | undefined): string {
  if (!value) return "";
  const withoutEscapes = value
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
  return withoutEscapes
    .replace(/[^A-Za-z0-9 .,'&():_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX_LENGTH)
    .trim();
}

export function resolveBrand(env: DeployEnvironment = process.env): string {
  return sanitizeBrand(valueFrom(env, ["DEPLOY_BRAND_NAME"]))
    || sanitizeBrand(valueFrom(env, ["NEXT_PUBLIC_APP_NAME"]))
    || "UNNAMED PROJECT";
}

export function resolveTheme(env: DeployEnvironment = process.env): AsciiTheme {
  const selected = env.DEPLOY_ASCII_THEME?.trim().toLowerCase();
  return selected === "ice" || selected === "mono" ? selected : "lime";
}

export function shouldUseColor(options: { noColor?: boolean; isTTY?: boolean; env?: DeployEnvironment } = {}): boolean {
  const noColor = options.noColor ?? (options.env ?? process.env).NO_COLOR !== undefined;
  const isTTY = options.isTTY ?? Boolean(process.stdout.isTTY);
  return isTTY && !noColor;
}

export function removeRecordFlag(args: string[]): { record: boolean; args: string[] } {
  return {
    record: args.includes("--record"),
    args: args.filter((argument) => argument !== "--record"),
  };
}

export function renderAsciiBrand(brandInput: string, options: {
  columns?: number;
  theme?: AsciiTheme;
  color?: boolean;
} = {}): string {
  const brand = sanitizeBrand(brandInput) || "UNNAMED PROJECT";
  const columns = Math.max(1, options.columns ?? DEFAULT_COLUMNS);
  const theme = options.theme ?? "lime";
  const color = options.color ?? false;
  const colorCode = color ? THEME_ANSI[theme].accent : "";
  const reset = color ? THEME_ANSI[theme].reset : "";

  if (columns < 32) {
    const prefix = columns >= 3 ? "> " : "";
    const wrapped = wrapWords(brand, Math.max(1, columns - prefix.length));
    return wrapped.map((line) => `${colorCode}${prefix}${line}${reset}`).join("\n");
  }

  const maxArtCharacters = Math.max(1, Math.floor((columns - 1) / 6));
  const segments = wrapWords(brand.toUpperCase(), maxArtCharacters);
  return segments.map((segment) => {
    const chars = [...segment];
    const lines = Array.from({ length: 7 }, (_, row) =>
      chars.map((char) => (GLYPHS[char] ?? GLYPHS[" "])[row]).join(" "),
    );
    return lines.map((line) => `${colorCode}${line}${reset}`).join("\n");
  }).join("\n\n");
}

function wrapWords(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = "";
    }
    if (word.length > width) {
      if (line) lines.push(line);
      for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
      line = "";
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["UNNAMED PROJECT"];
}

export function assertNoBroadcastArgs(args: string[]): void {
  const blocked = /^(--broadcast(?:=.*)?|--resume|--verify(?:=.*)?|--account(?:=.*)?|--sender(?:=.*)?|--private-key(?:=.*)?|--keystore(?:=.*)?|--mnemonic(?:=.*)?|--mnemonic-derivation-path(?:=.*)?|--mnemonic-passphrase(?:=.*)?|--ledger|--trezor|--unlocked)$/;
  const found = args.find((arg) => blocked.test(arg));
  if (found) throw new Error(`deployment simulation refuses broadcast, verification, and signer option: ${found.split("=", 1)[0]}`);
}

function validHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function addressEnvFor(definition: ContractDefinition, env: DeployEnvironment): { address?: Address; configured: boolean; invalid: boolean } {
  if (definition.external) {
    return { address: OFFICIAL_EXTERNAL_ADDRESSES[definition.name], configured: true, invalid: false };
  }
  const raw = valueFrom(env, definition.addressEnv);
  if (!raw) return { configured: false, invalid: false };
  if (!isAddress(raw)) return { configured: true, invalid: true };
  return { address: raw as Address, configured: true, invalid: false };
}

function normalizeContractName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function chainIdFromArtifact(raw: unknown, artifactPath: string): number | null {
  const root = raw as { chain?: unknown; chainId?: unknown };
  const rawChain = typeof root?.chain === "number" ? root.chain : typeof root?.chainId === "number" ? root.chainId : null;
  if (rawChain !== null) return rawChain;
  const pathMatch = artifactPath.match(/(?:^|[/\\])(\d{4,})(?:[/\\]|$)/);
  return pathMatch ? Number(pathMatch[1]) : null;
}

export async function scanBroadcastArtifacts(rootDir: string): Promise<BroadcastScan> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const broadcastRoot = path.join(rootDir, "contracts", "broadcast");
  const files: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && /^run-(?:latest|\d+)\.json$/.test(entry.name)) files.push(full);
    }
  };

  await walk(broadcastRoot);
  const deployments: BroadcastDeployment[] = [];
  let localArtifactCount = 0;
  let unclassifiedArtifactCount = 0;
  let giwaCandidateCount = 0;

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      unclassifiedArtifactCount += 1;
      continue;
    }
    const root = raw as { transactions?: unknown[] };
    const chainId = chainIdFromArtifact(raw, path.relative(rootDir, file));
    const txs = Array.isArray(root?.transactions) ? root.transactions : [];
    const creates = txs.filter((item) => {
      const tx = item as { contractAddress?: unknown; hash?: unknown; transactionType?: unknown };
      return typeof tx.contractAddress === "string" && typeof tx.hash === "string" &&
        (tx.transactionType === undefined || String(tx.transactionType).toUpperCase().includes("CREATE"));
    });

    if (chainId === 31337 || chainId === 1337) {
      localArtifactCount += creates.length || 1;
      continue;
    }
    if (chainId !== GIWA_SEPOLIA_CHAIN_ID) {
      unclassifiedArtifactCount += creates.length || 1;
      continue;
    }

    for (const item of creates) {
      const tx = item as { contractName?: unknown; contractAddress: string; hash: string };
      if (!ADDRESS_RE.test(tx.contractAddress) || !HASH_RE.test(tx.hash)) continue;
      giwaCandidateCount += 1;
      deployments.push({
        chainId,
        artifactPath: path.relative(rootDir, file),
        contractName: typeof tx.contractName === "string" ? tx.contractName : "Unknown contract",
        contractAddress: tx.contractAddress as Address,
        transactionHash: tx.hash as Hex,
      });
    }
  }

  return { deployments, localArtifactCount, unclassifiedArtifactCount, giwaCandidateCount };
}

function errorKind(_error: unknown): string {
  return "request failed; check RPC reachability and URL configuration";
}

async function checkVerification(
  address: Address,
  fetcher: typeof fetch,
): Promise<VerificationStatus> {
  try {
    const response = await fetcher(`${GIWA_EXPLORER_URL}/api/v2/addresses/${address}`, {
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return "UNKNOWN";
    const body = (await response.json()) as { is_verified?: unknown };
    if (body.is_verified === true) return "SOURCE VERIFIED";
    if (body.is_verified === false) return "NOT VERIFIED";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

function firstReceiptFor(definition: ContractDefinition, receipts: ConfirmedDeployment[]): ConfirmedDeployment | undefined {
  if (definition.artifactNames.includes("ControlledTestToken")) return undefined;
  const names = new Set(definition.artifactNames.map(normalizeContractName));
  return receipts.find((receipt) => names.has(normalizeContractName(receipt.contractName)));
}

function missingDependencies(definition: ContractDefinition, env: DeployEnvironment): string[] {
  const present = (key: string) => Boolean(env[key]?.trim());
  return (definition.dependencies ?? []).filter((dependency) => {
    if (dependency.startsWith("GIWA_")) return !present(dependency);
    if (dependency === "LendingPoolV2 deployment script") return false;
    return false;
  });
}

export async function collectDeploymentReport(options: CollectOptions = {}): Promise<DeploymentReport> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const brand = resolveBrand(env);
  const theme = resolveTheme(env);
  const rawRpc = valueFrom(env, ["DEPLOY_RPC_URL", "GIWA_RPC_URL", "NEXT_PUBLIC_GIWA_RPC_URL"])
    ?? (options.env === undefined ? appEnv.giwaRpcUrl : undefined);
  const rpcUrl = validHttpUrl(rawRpc);
  const configurationErrors: string[] = [];
  if (rawRpc && !rpcUrl) configurationErrors.push("RPC URL is not a valid HTTP(S) URL");

  const signerRaw = valueFrom(env, ["DEPLOY_SIGNER_ADDRESS", "GIWA_ADMIN_ADDRESS"]);
  const signerValid = signerRaw ? isAddress(signerRaw) : false;
  if (signerRaw && !signerValid) configurationErrors.push("Deployment signer address is invalid");

  const scan = await scanBroadcastArtifacts(cwd);
  const createClient = options.createClient ?? ((url: string) => createPublicClient({ transport: http(url, { timeout: 10_000 }) }) as unknown as RpcClient);
  const fetcher = options.fetcher ?? fetch;
  let rpcStatus: RpcStatus = !rawRpc ? "NOT CONFIGURED" : "UNAVAILABLE";
  let actualChainId: number | undefined;
  let latestBlock: bigint | undefined;
  let rpcError: string | undefined;
  let signerBalance: bigint | undefined;
  const confirmedDeployments: ConfirmedDeployment[] = [];
  let client: RpcClient | undefined;

  if (rpcUrl) {
    try {
      client = createClient(rpcUrl);
      actualChainId = await client.getChainId();
      if (actualChainId !== GIWA_SEPOLIA_CHAIN_ID) {
        rpcStatus = "WRONG CHAIN";
        rpcError = `expected ${GIWA_SEPOLIA_CHAIN_ID}, received ${actualChainId}`;
      } else {
        rpcStatus = "AVAILABLE";
        const block = await client.getBlock({ blockTag: "latest" });
        latestBlock = block.number ?? undefined;
      }
    } catch (error) {
      rpcStatus = "UNAVAILABLE";
      rpcError = errorKind(error);
      client = undefined;
    }
  }

  if (rpcStatus === "AVAILABLE" && client) {
    if (signerValid && signerRaw) {
      try {
        signerBalance = await client.getBalance({ address: signerRaw as Address });
      } catch {
        configurationErrors.push("Signer balance could not be read from GIWA Sepolia RPC");
      }
    }
    for (const candidate of scan.deployments) {
      try {
        const receipt = await client.getTransactionReceipt({ hash: candidate.transactionHash });
        if (receipt.status !== "success" || !receipt.contractAddress) continue;
        if (receipt.contractAddress.toLowerCase() !== candidate.contractAddress.toLowerCase()) continue;
        const bytecode = await client.getBytecode({ address: receipt.contractAddress });
        if (!bytecode || bytecode === "0x") continue;
        confirmedDeployments.push({
          ...candidate,
          contractAddress: receipt.contractAddress,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          explorerTransactionUrl: `${GIWA_EXPLORER_URL}/tx/${receipt.transactionHash}`,
          explorerContractUrl: `${GIWA_EXPLORER_URL}/address/${receipt.contractAddress}`,
        });
      } catch {
        // A Foundry artifact is only a local record until GIWA returns a successful receipt.
      }
    }
  }

  const definitions = CONTRACT_DEFINITIONS;
  const contracts: ContractEvidence[] = [];
  for (const definition of definitions) {
    if (definition.name === "UtilizationRateModel") {
      contracts.push({
        name: definition.name,
        status: "NOT A DEPLOYMENT TARGET",
        dependencies: [],
        missingDependencies: [],
        note: definition.note,
      });
      continue;
    }
    const config = addressEnvFor(definition, env);
    const receipt = firstReceiptFor(definition, confirmedDeployments);
    const address = config.address ?? receipt?.contractAddress;
    const missing = missingDependencies(definition, env);
    let status: ContractStatus = "NOT CONFIGURED";
    let bytecodePresent: boolean | undefined;
    let verification: VerificationStatus | undefined;

    if (config.invalid) {
      status = "ERROR";
      configurationErrors.push(`${definition.name} has an invalid configured address`);
    } else if (!address) {
      status = definition.external ? "ERROR" : "NOT CONFIGURED";
    } else if (rpcStatus === "WRONG CHAIN") {
      status = "BLOCKED";
    } else if (rpcStatus !== "AVAILABLE" || !client) {
      status = "ERROR";
    } else {
      try {
        const code = await client.getBytecode({ address });
        bytecodePresent = Boolean(code && code !== "0x");
        if (!bytecodePresent) status = "NOT DEPLOYED";
        else {
          status = receipt && receipt.contractAddress.toLowerCase() === address.toLowerCase()
            ? "DEPLOYED / RECEIPT CONFIRMED"
            : "CODE PRESENT";
        }
      } catch {
        status = "ERROR";
      }
    }

    contracts.push({
      name: definition.name,
      status,
      address,
      external: definition.external,
      dependencies: definition.dependencies ?? [],
      missingDependencies: missing,
      bytecodePresent,
      verification,
      explorerUrl: address ? `${GIWA_EXPLORER_URL}/address/${address}` : undefined,
      receipt: address ? confirmedDeployments.find((candidate) => candidate.contractAddress.toLowerCase() === address.toLowerCase()) : undefined,
      note: definition.note,
    });
  }

  const verificationTargets = contracts.filter(
    (contract) => contract.address && contract.bytecodePresent && !contract.external,
  );
  const verificationResults = await Promise.all(
    verificationTargets.map((contract) => checkVerification(contract.address!, fetcher)),
  );
  verificationTargets.forEach((contract, index) => {
    contract.verification = verificationResults[index];
    if (contract.verification === "SOURCE VERIFIED") contract.status = "SOURCE VERIFIED";
  });

  const contractByName = new Map(contracts.map((contract) => [contract.name, contract]));
  for (const contract of contracts) {
    const unavailableDependencies = contract.dependencies.flatMap((dependency) => {
      const item = contractByName.get(dependency);
      if (!item || !["NOT CONFIGURED", "NOT DEPLOYED", "BLOCKED", "ERROR"].includes(item.status)) return [];
      return [`${dependency} (${item.status})`];
    });
    contract.missingDependencies = [...new Set([...contract.missingDependencies, ...unavailableDependencies])];
  }

  const signerStatus = !signerRaw ? "NOT CONFIGURED" : signerValid ? "CONFIGURED" : "ERROR";
  return {
    brand,
    theme,
    rpcUrlConfigured: Boolean(rpcUrl),
    rpcStatus,
    actualChainId,
    latestBlock,
    rpcError,
    signerAddress: signerValid ? (signerRaw as Address) : undefined,
    signerStatus,
    signerBalance,
    contracts,
    confirmedDeployments,
    localArtifactCount: scan.localArtifactCount,
    unclassifiedArtifactCount: scan.unclassifiedArtifactCount,
    giwaCandidateCount: scan.giwaCandidateCount,
    configurationErrors: [...new Set(configurationErrors)],
  };
}

export function formatNativeBalance(balance: bigint): string {
  return `${formatEther(balance)} ETH`;
}

export function explorerAddressUrl(address: Address): string {
  return `${GIWA_EXPLORER_URL}/address/${address}`;
}
