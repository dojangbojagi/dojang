#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import {
  assertNoBroadcastArgs,
  collectDeploymentReport,
  formatNativeBalance,
  GIWA_EXPLORER_URL,
  GIWA_SEPOLIA_CHAIN_ID,
  removeRecordFlag,
  renderAsciiBrand,
  resolveBrand,
  resolveTheme,
  shouldUseColor,
  type ContractEvidence,
  type DeploymentReport,
} from "./deploy-console-core";

const VALID_COMMANDS = ["status", "replay", "ascii", "simulate"] as const;
type Command = (typeof VALID_COMMANDS)[number];

function usage(): never {
  process.stderr.write(
    "Usage: bun scripts/deploy-console.ts <status|replay|ascii|simulate> [--record] [-- <forge simulation args>]\n",
  );
  process.exit(2);
}

function parseArguments(args: string[]): { command: Command; record: boolean; commandArgs: string[] } {
  const command = args[0] as Command | undefined;
  if (!command || !VALID_COMMANDS.includes(command)) usage();

  const { record, args: rest } = removeRecordFlag(args.slice(1));
  if (command !== "simulate" && rest.length > 0) usage();
  const separator = rest.indexOf("--");
  const commandArgs = separator === -1 ? rest : rest.slice(separator + 1);
  if (separator !== -1 && command !== "simulate") usage();
  return { command, record, commandArgs };
}

const colors = {
  lime: { accent: "\u001b[92m", info: "\u001b[96m", muted: "\u001b[90m", warning: "\u001b[93m", error: "\u001b[91m", reset: "\u001b[0m" },
  ice: { accent: "\u001b[96m", info: "\u001b[94m", muted: "\u001b[90m", warning: "\u001b[93m", error: "\u001b[91m", reset: "\u001b[0m" },
  mono: { accent: "\u001b[97m", info: "\u001b[37m", muted: "\u001b[90m", warning: "\u001b[97m", error: "\u001b[97m", reset: "\u001b[0m" },
} as const;

function paint(value: string, role: keyof (typeof colors)["lime"], report: DeploymentReport): string {
  if (!shouldUseColor()) return value;
  const palette = colors[report.theme];
  return `${palette[role]}${value}${palette.reset}`;
}

async function typewriter(line: string, record: boolean): Promise<void> {
  if (!record || !process.stdout.isTTY || process.env.NO_COLOR !== undefined) {
    process.stdout.write(`${line}\n`);
    return;
  }
  for (const character of line) {
    process.stdout.write(character);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  process.stdout.write("\n");
}

function statusRole(status: string): keyof (typeof colors)["lime"] {
  if (status === "SOURCE VERIFIED" || status === "DEPLOYED / RECEIPT CONFIRMED" || status === "AVAILABLE") return "accent";
  if (status === "BLOCKED" || status === "NOT DEPLOYED" || status === "NOT CONFIGURED" || status === "NOT VERIFIED") return "warning";
  if (status === "ERROR" || status === "UNAVAILABLE" || status === "WRONG CHAIN") return "error";
  return "info";
}

function blockString(value?: bigint): string {
  return value === undefined ? "unavailable" : value.toString();
}

function shortAddress(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function contractRow(contract: ContractEvidence, report: DeploymentReport): string {
  const status = paint(contract.status, statusRole(contract.status), report);
  const address = contract.address ? shortAddress(contract.address) : "—";
  const receipt = contract.receipt ? ` | tx ${shortAddress(contract.receipt.transactionHash)}` : "";
  const explorer = contract.explorerUrl ? ` | ${contract.explorerUrl}` : "";
  const source = contract.verification ? ` | source: ${contract.verification}` : "";
  const missing = contract.missingDependencies.length ? ` | missing: ${contract.missingDependencies.join(", ")}` : "";
  const note = contract.note ? ` | ${contract.note}` : "";
  return `  ${contract.name}: ${status} | ${address}${receipt}${explorer}${source}${missing}${note}`;
}

async function reportLines(report: DeploymentReport): Promise<string[]> {
  const lines = [
    "GIWA SEPOLIA DEPLOYMENT READINESS (READ ONLY)",
    `Network: GIWA Sepolia | expected chain ${GIWA_SEPOLIA_CHAIN_ID} | actual chain ${report.actualChainId ?? "unavailable"}`,
    `RPC: ${report.rpcStatus} | latest block ${blockString(report.latestBlock)}`,
  ];
  if (report.rpcError) lines.push(`RPC detail: ${report.rpcError}`);
  lines.push(
    `Signer: ${report.signerStatus}${report.signerAddress ? ` | ${report.signerAddress}` : ""}${report.signerBalance !== undefined ? ` | ${formatNativeBalance(report.signerBalance)}` : ""}`,
    `Explorer: ${GIWA_EXPLORER_URL}`,
    `Project contract inventory (${report.contracts.filter((item) => !item.external && item.status !== "NOT A DEPLOYMENT TARGET").length} project entries):`,
  );
  for (const contract of report.contracts) lines.push(contractRow(contract, report));
  lines.push(`Confirmed GIWA deployment receipts: ${report.confirmedDeployments.length}`);
  if (report.giwaCandidateCount === 0) lines.push("  No chain-91342 deployment records were found in Foundry broadcast artifacts.");
  else if (report.confirmedDeployments.length === 0) lines.push("  Foundry candidates were not confirmed by a successful GIWA receipt and bytecode read.");
  else if (report.confirmedDeployments.length < report.giwaCandidateCount) lines.push("  Some Foundry candidates did not pass receipt and bytecode confirmation.");
  for (const receipt of report.confirmedDeployments) {
    lines.push(`  ${receipt.contractName} ${receipt.contractAddress} | block ${receipt.blockNumber} | ${receipt.explorerTransactionUrl}`);
  }
  lines.push(`Foundry artifacts excluded as local Anvil: ${report.localArtifactCount}`);
  lines.push(`Unclassified artifacts excluded: ${report.unclassifiedArtifactCount}`);
  lines.push(`GIWA deployment candidates found in Foundry artifacts: ${report.giwaCandidateCount}`);
  if (report.configurationErrors.length) {
    lines.push("Configuration / read errors:");
    for (const error of report.configurationErrors) lines.push(`  - ${error}`);
  }
  lines.push("Read-only inspection complete. No transaction was submitted.");
  return lines;
}

async function printReport(report: DeploymentReport, record: boolean): Promise<void> {
  const useColor = shouldUseColor();
  const banner = renderAsciiBrand(report.brand, {
    columns: process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80,
    theme: report.theme,
    color: useColor,
  });
  for (const line of banner.split("\n")) await typewriter(line, record);
  await typewriter("", record);

  const lines = await reportLines(report);
  for (const line of lines) {
    const status = line.match(/\b(SOURCE VERIFIED|DEPLOYED \/ RECEIPT CONFIRMED|NOT CONFIGURED|NOT DEPLOYED|BLOCKED|ERROR|AVAILABLE|UNAVAILABLE|WRONG CHAIN)\b/);
    const role = status ? statusRole(status[1]) : line.startsWith("Explorer:") ? "info" : "muted";
    await typewriter(paint(line, role, report), record);
  }

  if (record && process.stdout.isTTY && process.env.NO_COLOR === undefined) {
    const counted = report.contracts.length;
    const barWidth = 24;
    const filled = counted ? Math.round((counted / report.contracts.length) * barWidth) : 0;
    process.stdout.write(`\nEvidence checks: [${"█".repeat(filled)}${"░".repeat(barWidth - filled)}] ${counted}/${report.contracts.length} contract entries inspected\n`);
  }
}

async function runReadOnly(command: "status" | "replay" | "ascii", record: boolean): Promise<void> {
  if (command === "ascii") {
    const brand = resolveBrand();
    process.stdout.write(`${renderAsciiBrand(brand, {
      columns: process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80,
      theme: resolveTheme(),
      color: shouldUseColor(),
    })}\n`);
    process.stdout.write(`GIWA Sepolia deployment console | chain ${GIWA_SEPOLIA_CHAIN_ID} | read only\n`);
    if (record && process.stdout.isTTY && process.env.NO_COLOR === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      process.stdout.write("ASCII display complete; no RPC calls or transactions were made.\n");
    }
    return;
  }

  if (record && process.stdout.isTTY && process.env.NO_COLOR === undefined) {
    process.stderr.write("\u001b[?25l");
    const frames = ["◜", "◠", "◝", "◞", "◡", "◟"];
    let frame = 0;
    const spinner = setInterval(() => {
      process.stderr.write(`\r${frames[frame++ % frames.length]} Reading GIWA RPC and deployment evidence…`);
    }, 90);
    try {
      const report = await collectDeploymentReport();
      clearInterval(spinner);
      process.stderr.write("\r\u001b[2K\u001b[?25h");
      await printReport(report, record);
    } catch (error) {
      clearInterval(spinner);
      process.stderr.write("\r\u001b[2K\u001b[?25h");
      throw error;
    }
    return;
  }

  const report = await collectDeploymentReport();
  await printReport(report, record);
}

function runSimulation(args: string[], record: boolean): number {
  try {
    assertNoBroadcastArgs(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "unsafe simulation arguments"}\n`);
    return 2;
  }
  if (args.length === 0) {
    process.stderr.write("Usage: bun run deploy:simulate -- <script:Contract> [guarded forge options]\n");
    return 2;
  }
  if (record && process.stdout.isTTY && process.env.NO_COLOR === undefined) {
    process.stdout.write("\u001b[92mSimulation only: existing guarded Forge wrapper\u001b[0m\n");
  } else {
    process.stdout.write("Simulation only: existing guarded Forge wrapper; broadcast and signer flags are rejected.\n");
  }
  const result = spawnSync("bash", ["scripts/forge-simulate.sh", ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    process.stderr.write(`Could not start guarded simulation: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

async function main(): Promise<void> {
  const { command, record, commandArgs } = parseArguments(process.argv.slice(2));
  if (command === "simulate") {
    process.exitCode = runSimulation(commandArgs, record);
    return;
  }
  try {
    await runReadOnly(command, record);
  } catch {
    process.stderr.write("Deployment console failed before producing a complete report. Check local configuration and RPC availability.\n");
    process.exitCode = 1;
  }
}

void main();
