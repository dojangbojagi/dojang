#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createPublicClient, defineChain, http } from "viem";
import { parseAllowedEnv } from "./validate-robinhood-mainnet-demo-config.mjs";
import {
  mainnetPresentationColorDepth,
  playMainnetPresentation,
  renderMainnetPresentation,
} from "./robinhood-mainnet-deploy-show-core.mjs";

const ROOT = process.cwd();
const CHAIN_ID = 4_663;
const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
const DEPLOYMENT = path.join(ROOT, "contracts/broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");

function readConfiguredRpcUrl() {
  if (process.env.RH_MAINNET_RPC_URL) return process.env.RH_MAINNET_RPC_URL;
  if (process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL) return process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL;
  try {
    const values = parseAllowedEnv(fs.readFileSync(path.join(ROOT, ".env"), "utf8"));
    return values.RH_MAINNET_RPC_URL || RPC_URL;
  } catch (error) {
    if (error?.code === "ENOENT") return RPC_URL;
    throw error;
  }
}

function safeMessage(error, rpcUrl) {
  const message = String(error instanceof Error ? error.message : error)
    .replaceAll(rpcUrl, "[configured Robinhood Mainnet RPC]")
    .replace(/https?:\/\/[^\s)]+/gi, "[endpoint]")
    .replace(/[\r\n]+/g, " ");
  if (/unable to connect|could not connect|connection refused|network is unreachable/i.test(message)) return "RPC connection unavailable.";
  if (/timed out|timeout/i.test(message)) return "RPC request timed out.";
  if (/chain.*(?:4663|expected)|wrong chain/i.test(message)) return "RPC chain ID check failed; required chain ID is 4663.";
  return message.slice(0, 160);
}

async function inspectNetwork(rpcUrl) {
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1, timeout: 12_000 }) });
  const chainId = await client.getChainId();
  if (chainId !== CHAIN_ID) return { rpcStatus: "wrong-chain", chainId };
  const headBlock = await client.getBlockNumber();
  return { rpcStatus: "connected", chainId, headBlock: headBlock.toString() };
}

function inspectDeployment(rpcUrl, extraArgs = []) {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/robinhood-mainnet-demo-postdeploy.mjs"), ...extraArgs], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, RH_MAINNET_RPC_URL: rpcUrl },
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(safeMessage((result.stderr || result.stdout || "Mainnet post-deployment readback failed").trim(), rpcUrl));
  }
  try {
    const report = JSON.parse(result.stdout.trim());
    if (report.readOnly !== true || report.chainId !== CHAIN_ID) throw new Error("Read-only checker returned an unexpected network or mode.");
    return report;
  } catch (error) {
    throw new Error(`Could not parse the read-only Mainnet validation result: ${safeMessage(error, rpcUrl)}`);
  }
}

function readLocalArtifactCount() {
  try {
    const artifact = JSON.parse(fs.readFileSync(DEPLOYMENT, "utf8"));
    return Array.isArray(artifact.transactions) ? artifact.transactions.length : 0;
  } catch {
    return undefined;
  }
}

function parseArgs(args) {
  const valid = new Set(["--presentation", "--plain", "--replay"]);
  for (const arg of args) {
    if (!valid.has(arg)) throw new Error(`Unknown option ${arg}; use --presentation, --plain, or --replay.`);
  }
  if (args.includes("--presentation") && args.includes("--plain")) {
    throw new Error("Choose one output mode: --presentation or --plain.");
  }
  return {
    presentation: args.includes("--presentation"),
    plain: args.includes("--plain"),
    replay: args.includes("--replay"),
  };
}

function isTransientRpcFailure(error) {
  return /RPC connection unavailable|RPC request timed out|HTTP request failed|fetch failed|ECONNRESET|network request failed/i.test(String(error?.message ?? error));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rpcUrl = options.replay ? undefined : readConfiguredRpcUrl();
  let report;
  let exitCode = 0;

  if (options.replay) {
    report = inspectDeployment("", ["--replay"]);
    report.kind = "offline-replay";
    report.liveStatus = "not requested";
  } else if (!fs.existsSync(DEPLOYMENT)) {
    let network;
    try {
      network = await inspectNetwork(rpcUrl);
      if (network.rpcStatus !== "connected") exitCode = 1;
    } catch (error) {
      network = { rpcStatus: "unavailable", rpcError: safeMessage(error, rpcUrl) };
      exitCode = 1;
    }
    report = { kind: "not-deployed", ...network };
  } else {
    try {
      report = inspectDeployment(rpcUrl);
      const expected = Number(report.successfulReceiptCount) === 10
        && report.deploymentReceipts?.length === 10
        && Object.keys(report.contracts ?? {}).length === 10;
      if (!expected) throw new Error("Mainnet artifact did not produce exactly 10 confirmed contract deployments.");
      report.kind = "deployed";
    } catch (error) {
      if (isTransientRpcFailure(error)) {
        try {
          report = inspectDeployment(rpcUrl, ["--replay"]);
          report.kind = "offline-replay";
          report.liveStatus = "unavailable";
          report.liveError = safeMessage(error, rpcUrl);
        } catch (replayError) {
          report = {
            kind: "unavailable",
            localTransactionCount: readLocalArtifactCount(),
            error: `${safeMessage(error, rpcUrl)}; local replay failed: ${safeMessage(replayError, rpcUrl)}`,
          };
          exitCode = 1;
        }
      } else {
        report = {
          kind: "unavailable",
          localTransactionCount: readLocalArtifactCount(),
          error: safeMessage(error, rpcUrl),
        };
        exitCode = 1;
      }
    }
  }

  const color = !options.plain && process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
  const presentationOptions = {
    columns: process.stdout.columns || 120,
    color,
    colorDepth: mainnetPresentationColorDepth(),
  };
  if (options.presentation) {
    const result = await playMainnetPresentation(report, {
      ...presentationOptions,
      tty: Boolean(process.stdout.isTTY) && process.env.TERM !== "dumb",
    });
    if (result.interrupted) exitCode = 130;
  } else {
    process.stdout.write(`${renderMainnetPresentation(report, presentationOptions)}\n`);
  }
  process.exitCode = exitCode;
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`Robinhood Mainnet deployment display failed: ${String(error?.message ?? error).replace(/[\r\n]+/g, " ").slice(0, 180)}\n`);
    process.exitCode = 1;
  });
}
