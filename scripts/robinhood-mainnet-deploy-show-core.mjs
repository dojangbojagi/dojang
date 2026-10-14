import {
  renderPresentation as renderTestnetPresentation,
  runPresentation as runTestnetPresentation,
} from "./robinhood-deploy-presentation.mjs";

const CONTRACT_GROUPS = [
  ["ZK INFRASTRUCTURE", ["ZKTranscriptLib", "RelationsLib", "HonkVerifier", "EligibilityVerifierAdapter"]],
  ["CREDENTIALS", ["RobinhoodMainnetDemoCredentialRegistry"]],
  ["LENDING", ["RobinhoodMainnetDemoOracle", "RobinhoodMainnetDemoTokenLoan", "RobinhoodMainnetDemoTokenCollateral", "RobinhoodMainnetDemoLendingPool"]],
  ["GOVERNANCE", ["RobinhoodMainnetDemoGovernancePhase1"]],
];

const CONTRACT_LABELS = {
  ZKTranscriptLib: "ZKTranscriptLib",
  RelationsLib: "RelationsLib",
  HonkVerifier: "HonkVerifier",
  EligibilityVerifierAdapter: "EligibilityVerifierAdapter",
  RobinhoodMainnetDemoCredentialRegistry: "RobinhoodMainnetDemoCredentialRegistry",
  RobinhoodMainnetDemoOracle: "RobinhoodMainnetDemoOracle",
  RobinhoodMainnetDemoTokenLoan: "RobinhoodMainnetDemoToken (dUSD)",
  RobinhoodMainnetDemoTokenCollateral: "RobinhoodMainnetDemoToken (dCOL)",
  RobinhoodMainnetDemoLendingPool: "RobinhoodMainnetDemoLendingPool",
  RobinhoodMainnetDemoGovernancePhase1: "RobinhoodMainnetDemoGovernancePhase1",
};

const LOGO_GLYPHS = [
  ["  ####  ", " ##     ", "##  ### ", "##    ##", " ###### "],
  ["##    ##", " ##  ## ", "  ####  ", "   ##   ", "   ##   "],
  ["########", "##      ", "######  ", "##      ", "########"],
  ["##    ##", "##    ##", " ##  ## ", " ##  ## ", "  ####  "],
  ["  ####  ", " ##  ## ", "##    ##", " ##  ## ", "  ####  "],
];
const ASCII_LOGO = Array.from({ length: LOGO_GLYPHS[0].length }, (_, row) => LOGO_GLYPHS.map((glyph) => glyph[row]).join("  "));

const ANSI = /\u001b\[[0-9;]*m/g;
const TESTNET_VISUAL_CONTRACTS = [
  { visualName: "ZKTranscriptLib", mainnetName: "ZKTranscriptLib", label: "ZKTranscriptLib" },
  { visualName: "RelationsLib", mainnetName: "RelationsLib", label: "RelationsLib" },
  { visualName: "HonkVerifier", mainnetName: "HonkVerifier", label: "HonkVerifier" },
  { visualName: "EligibilityVerifierAdapter", mainnetName: "EligibilityVerifierAdapter", label: "EligibilityVerifierAdapter" },
  { visualName: "RobinhoodDemoCredentialRegistry", mainnetName: "RobinhoodMainnetDemoCredentialRegistry", label: "RobinhoodMainnetDemoCredentialRegistry" },
  { visualName: "ControlledTestOracle", mainnetName: "RobinhoodMainnetDemoOracle", label: "RobinhoodMainnetDemoOracle" },
  { visualName: "rUSD2", mainnetName: "RobinhoodMainnetDemoTokenLoan", label: "RobinhoodMainnetDemoToken (dUSD)" },
  { visualName: "rCOL2", mainnetName: "RobinhoodMainnetDemoTokenCollateral", label: "RobinhoodMainnetDemoToken (dCOL)" },
  { visualName: "LendingPoolV2", mainnetName: "RobinhoodMainnetDemoLendingPool", label: "RobinhoodMainnetDemoLendingPool" },
  { visualName: "RobinhoodGovernancePhase1", mainnetName: "RobinhoodMainnetDemoGovernancePhase1", label: "RobinhoodMainnetDemoGovernancePhase1" },
];
const VISUAL_CONTRACT_BY_NAME = new Map(TESTNET_VISUAL_CONTRACTS.map((entry) => [entry.visualName, entry]));
const PALETTE = {
  burgundy: { rgb: [198, 56, 96], ansi256: 168, ansi16: 91 },
  rose: { rgb: [225, 138, 164], ansi256: 217, ansi16: 97 },
  white: { rgb: [244, 237, 239], ansi256: 255, ansi16: 97 },
  muted: { rgb: [185, 163, 169], ansi256: 181, ansi16: 90 },
  green: { rgb: [116, 196, 153], ansi256: 114, ansi16: 92 },
  amber: { rgb: [229, 182, 102], ansi256: 179, ansi16: 93 },
};

function colorize(value, tone, enabled, depth) {
  if (!enabled || !PALETTE[tone]) return value;
  const color = PALETTE[tone];
  const prefix = depth === "truecolor"
    ? `\u001b[38;2;${color.rgb.join(";")}m`
    : depth === "16"
      ? `\u001b[${color.ansi16}m`
      : `\u001b[38;5;${color.ansi256}m`;
  return `${prefix}${value}\u001b[0m`;
}

function wrap(value, maxWidth) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const rows = [];
  let row = "";
  for (const word of words) {
    if (word.length > maxWidth) {
      if (row) rows.push(row);
      row = "";
      for (let index = 0; index < word.length; index += maxWidth) rows.push(word.slice(index, index + maxWidth));
    } else if (!row) row = word;
    else if (row.length + word.length + 1 <= maxWidth) row += ` ${word}`;
    else {
      rows.push(row);
      row = word;
    }
  }
  if (row) rows.push(row);
  return rows.length ? rows : [""];
}

function addressRows(name, address, maxWidth) {
  const label = CONTRACT_LABELS[name] ?? name;
  const content = `${label.padEnd(34)} ${address ?? "address unavailable"}`;
  if (content.length <= maxWidth) return [content];
  return [`${label}:`, ...wrap(address ?? "address unavailable", maxWidth)];
}

function makeBoxRenderer({ columns = 120, color = false, colorDepth = "256" } = {}) {
  const width = Math.max(78, Math.min(118, Math.floor(columns) - 2));
  const innerWidth = width - 4;
  const rows = [];
  const border = (char = "-") => colorize(`+${char.repeat(width - 2)}+`, "burgundy", color, colorDepth);
  const line = (value = "", tone = "white") => wrap(value, innerWidth).forEach((text) => {
    rows.push(`| ${colorize(text.padEnd(innerWidth), tone, color, colorDepth)} |`);
  });
  const section = (title) => {
    rows.push(border());
    line(title, "rose");
    rows.push(border());
  };
  const scene = () => {
    const current = [...rows];
    rows.length = 0;
    return current;
  };
  return { width, innerWidth, rows, border, line, section, scene };
}

function normalizedName(name) {
  return name === "RobinhoodMainnetDemoTokenLoan" || name === "RobinhoodMainnetDemoTokenCollateral"
    ? "RobinhoodMainnetDemoToken"
    : name;
}

function sourceLabel(status) {
  if (status === "verified") return ["SOURCE VERIFIED", "green"];
  if (status === "not verified") return ["SOURCE NOT VERIFIED", "amber"];
  return [`SOURCE UNKNOWN${status?.startsWith("unavailable") ? " (LIVE CHECK UNAVAILABLE)" : ""}`, "muted"];
}

function receiptFor(report, name) {
  return report.deploymentReceipts?.find((receipt) => receipt.name === name);
}

function buildNotDeployedScenes(report, options) {
  const box = makeBoxRenderer(options);
  const scenes = [];
  box.rows.push(box.border("="));
  box.line("G Y E V O", "white");
  for (const row of ASCII_LOGO) box.line(row, "rose");
  box.line("PRIVATE ELIGIBILITY. PUBLIC EXECUTION.", "rose");
  box.line("ROBINHOOD CHAIN MAINNET  |  CHAIN 4663", "rose");
  box.line("CONTROLLED DEMO DEPLOYMENT  |  READ ONLY", "muted");
  box.rows.push(box.border("="));
  scenes.push(box.scene());

  box.section("01 / MAINNET NETWORK READBACK");
  if (report.rpcStatus === "connected") {
    box.line(`LIVE RPC: CONNECTED  |  chain ${report.chainId}  |  head ${report.headBlock}`, "green");
  } else if (report.rpcStatus === "wrong-chain") {
    box.line(`LIVE RPC: WRONG CHAIN  |  received ${report.chainId ?? "unknown"}  |  required 4663`, "amber");
  } else {
    box.line("LIVE RPC: UNAVAILABLE  |  network status could not be confirmed", "amber");
    if (report.rpcError) box.line(`RPC detail: ${report.rpcError}`, "muted");
  }
  box.line("DEPLOYMENT ARTIFACT: ABSENT  |  no Mainnet contract addresses recorded", "amber");
  box.line("PROJECT DEPLOYMENT: NOT DEPLOYED", "amber");
  box.line("Public receipts checked: 0  |  bytecode checks: not applicable", "muted");
  box.line("Blockscout source status: not applicable until Mainnet addresses exist", "muted");
  scenes.push(box.scene());

  box.section("02 / CONTRACT REGISTRY");
  for (const [groupIndex, [group, names]] of CONTRACT_GROUPS.entries()) {
    box.line(`${String(groupIndex + 1).padStart(2, "0")}  ${group}`, "rose");
    for (const name of names) box.line(`${CONTRACT_LABELS[name].padEnd(34)} NOT DEPLOYED`, "muted");
  }
  scenes.push(box.scene());

  box.section("03 / LIVE STATE & ROLES");
  box.line("Paused states, token supplies, oracle state, roles and dependencies: UNAVAILABLE", "muted");
  box.line("No Mainnet contract readbacks are reported without deployed addresses.", "muted");
  box.rows.push(box.border());
  box.line("NO TESTNET ADDRESSES OR TESTNET TRANSACTIONS ARE INCLUDED.", "rose");
  box.line("READ ONLY  |  NO SIGNING, DEPLOYMENT OR STATE CHANGES", "muted");
  box.rows.push(box.border("="));
  scenes.push(box.scene());
  return scenes;
}

function buildUnavailableScenes(report, options) {
  const box = makeBoxRenderer(options);
  const scenes = [];
  box.rows.push(box.border("="));
  box.line("G Y E V O", "white");
  for (const row of ASCII_LOGO) box.line(row, "rose");
  box.line("PRIVATE ELIGIBILITY. PUBLIC EXECUTION.", "rose");
  box.line("ROBINHOOD CHAIN MAINNET  |  CHAIN 4663", "rose");
  box.line("CONTROLLED DEMO DEPLOYMENT  |  READ ONLY", "muted");
  box.rows.push(box.border("="));
  scenes.push(box.scene());

  box.section("01 / LIVE VALIDATION UNAVAILABLE");
  box.line("LIVE RPC / RECEIPT CHECK: UNAVAILABLE", "amber");
  if (report.localTransactionCount !== undefined) {
    box.line(`Local Foundry run records: ${report.localTransactionCount} entries; these are not public receipts.`, "muted");
  }
  box.line("Project deployment status: UNVERIFIED", "amber");
  box.line("No Mainnet addresses, bytecode, roles or source status are promoted from a local artifact.", "muted");
  if (report.error) box.line(`Readback error: ${report.error}`, "muted");
  scenes.push(box.scene());

  box.section("02 / CONTRACT REGISTRY");
  for (const [groupIndex, [group, names]] of CONTRACT_GROUPS.entries()) {
    box.line(`${String(groupIndex + 1).padStart(2, "0")}  ${group}`, "rose");
    for (const name of names) box.line(`${CONTRACT_LABELS[name].padEnd(34)} LIVE STATUS UNAVAILABLE`, "muted");
  }
  scenes.push(box.scene());

  box.section("03 / LIVE STATE & ROLES");
  box.line("Paused states, token supplies, oracle state and role assignments: UNAVAILABLE", "muted");
  box.line("Retry when Robinhood Mainnet RPC and Blockscout reads are available.", "muted");
  box.rows.push(box.border());
  box.line("READ ONLY  |  NO SIGNING, DEPLOYMENT OR STATE CHANGES", "muted");
  box.rows.push(box.border("="));
  scenes.push(box.scene());
  return scenes;
}

function buildOfflineReplayScenes(report, options) {
  const box = makeBoxRenderer(options);
  const scenes = [];
  box.rows.push(box.border("="));
  box.line("G Y E V O", "white");
  for (const row of ASCII_LOGO) box.line(row, "rose");
  box.line("PRIVATE ELIGIBILITY. PUBLIC EXECUTION.", "rose");
  box.line("ROBINHOOD CHAIN MAINNET  |  CHAIN 4663", "rose");
  box.line("HISTORICAL RECEIPT REPLAY  |  LOCAL ARTIFACT ONLY", "amber");
  box.rows.push(box.border("="));
  scenes.push(box.scene());

  box.section("01 / RECORDED DEPLOYMENT EVIDENCE");
  box.line(`Foundry artifact: ${report.deploymentArtifact}`, "muted");
  box.line(`Artifact commit: ${report.artifactCommit ?? "not recorded"}  |  time: ${report.artifactTimestamp ?? "not recorded"}`, "muted");
  box.line(`Recorded successful creation receipts: ${report.successfulReceiptCount}/10`, report.successfulReceiptCount === 10 ? "green" : "amber");
  box.line("These are receipt records from the local artifact, not current RPC confirmations.", "amber");
  box.line(`Live RPC: ${report.liveStatus === "unavailable" ? "UNAVAILABLE" : "NOT REQUESTED"}${report.liveError ? ` | ${report.liveError}` : ""}`, "amber");
  box.line("Live bytecode: NOT CHECKED  |  Blockscout source: NOT CHECKED", "muted");
  scenes.push(box.scene());

  for (const [groupIndex, [group, names]] of CONTRACT_GROUPS.entries()) {
    box.section(`${String(groupIndex + 1).padStart(2, "0")} / ${group}`);
    for (const name of names) {
      const address = report.contracts?.[name];
      const receipt = receiptFor(report, name);
      for (const row of addressRows(name, address, box.innerWidth)) box.line(row, address ? "white" : "amber");
      const recordedStatus = receipt?.status === "recorded_success" ? "RECORDED RECEIPT SUCCESS" : "RECORDED RECEIPT UNCONFIRMED";
      const hash = receipt?.transactionHash;
      const shortHash = hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : "hash unavailable";
      box.line(`  ${recordedStatus} ${shortHash}`, receipt?.status === "recorded_success" ? "green" : "amber");
      box.line("  LIVE BYTECODE NOT CHECKED  |  SOURCE NOT CHECKED", "muted");
    }
    scenes.push(box.scene());
  }

  box.section("06 / CONTRACT STATE");
  box.line("Paused states, token supplies, oracle prices, roles and dependencies: NOT READ OFFLINE", "muted");
  box.line("Recorded transaction success does not establish current contract state.", "amber");
  box.rows.push(box.border("="));
  box.line("HISTORICAL LOCAL RECEIPTS ONLY  |  NO LIVE VALIDATION CLAIMS", "amber");
  box.line("READ ONLY  |  NO SIGNING, DEPLOYMENT OR STATE CHANGES", "muted");
  box.rows.push(box.border("="));
  scenes.push(box.scene());
  return scenes;
}

function buildDeployedScenes(report, options, { verbose = false } = {}) {
  const box = makeBoxRenderer(options);
  const scenes = [];
  const verifiedSources = report.blockscoutSourceVerification?.verifiedCount ?? 0;
  const totalSources = report.blockscoutSourceVerification?.total ?? 10;
  const receiptCount = report.successfulReceiptCount ?? 0;
  const liveBytecodeCount = report.deploymentReceipts?.filter((receipt) => receipt.liveBytecodeStatus).length ?? 0;
  const sourceStatuses = Object.values(report.blockscoutSourceVerification?.statusByContract ?? {});
  const sourceNotVerified = sourceStatuses.filter((status) => status === "not verified").length;
  const sourceUnavailable = sourceStatuses.filter((status) => String(status).startsWith("unavailable")).length;

  box.rows.push(box.border("="));
  box.line("G Y E V O", "white");
  for (const row of ASCII_LOGO) box.line(row, "rose");
  box.line("PRIVATE ELIGIBILITY. PUBLIC EXECUTION.", "rose");
  box.line("ROBINHOOD CHAIN MAINNET  |  CHAIN 4663", "rose");
  box.line("CONTROLLED DEMO DEPLOYMENT  |  LIVE READ ONLY", "muted");
  box.rows.push(box.border("="));
  scenes.push(box.scene());

  box.section("01 / LIVE MAINNET VALIDATION");
  box.line(`RPC CONNECTED  |  chain ${report.chainId}  |  head ${report.headBlock}`, "green");
  box.line(`Contract deployments with successful receipts: ${receiptCount}/10`, receiptCount === 10 ? "green" : "amber");
  box.line(`Live runtime bytecode matched: ${liveBytecodeCount}/10`, liveBytecodeCount === 10 ? "green" : "amber");
  box.line(`Blockscout source: ${verifiedSources} verified | ${sourceNotVerified} not verified | ${sourceUnavailable} unavailable`, verifiedSources === totalSources ? "green" : "amber");
  box.line("Deployment and source-verification counts are separate evidence.", "muted");
  scenes.push(box.scene());

  for (const [groupIndex, [group, names]] of CONTRACT_GROUPS.entries()) {
    box.section(`${String(groupIndex + 1).padStart(2, "0")} / ${group}`);
    for (const name of names) {
      const address = report.contracts?.[name];
      const record = receiptFor(report, name);
      for (const row of addressRows(name, address, box.innerWidth)) box.line(row, address ? "white" : "amber");
      const [sourceText, sourceTone] = sourceLabel(report.blockscoutSourceVerification?.statusByContract?.[name]);
      const hash = record?.transactionHash;
      const shortHash = hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : "receipt unavailable";
      const receiptStatus = record?.status === "success" ? "RECEIPT SUCCESS" : "RECEIPT UNCONFIRMED";
      const bytecodeText = record?.liveBytecodeStatus ? "BYTECODE MATCHED" : "BYTECODE NOT CONFIRMED";
      box.line(`  ${receiptStatus} ${shortHash}  |  ${bytecodeText}  |  ${sourceText}`, record?.status === "success" && record?.liveBytecodeStatus && sourceText === "SOURCE VERIFIED" ? "green" : sourceTone);
      if (verbose && record) {
        box.line(`  TX ${record.transactionHash}`, "muted");
        box.line(`  BLOCK ${record.blockNumber}  |  GAS ${record.gasUsed}  |  BYTECODE ${record.runtimeCodeHash}`, "muted");
      }
    }
    scenes.push(box.scene());
  }

  box.section("06 / PAUSE, ASSET & ROLE READBACKS");
  const checks = report.roleAndDependencyChecks ?? [];
  const roleChecks = checks.filter((item) => item.includes(" role confirmed"));
  const dependencyChecks = checks.filter((item) => item.includes("dependency confirmed") || item.includes("reserve addresses confirmed"));
  const exactCheck = (fragment) => checks.some((item) => item.includes(fragment));
  const hasRole = (fragment) => roleChecks.some((item) => item.includes(fragment));
  const hasExpectedRoles = (fragments) => fragments.every(hasRole);
  const expectedTokenAndLendingRoles = hasExpectedRoles([
    "loan demo token admin", "loan demo token minter", "collateral demo token admin", "collateral demo token minter",
    "Lending admin", "Lending risk admin", "Lending pause authority",
  ]) && roleChecks.filter((item) => item.includes("demo participant role confirmed")).length === 2;
  box.line(`On-chain access-control roles confirmed: ${roleChecks.length}/15`, roleChecks.length === 15 ? "green" : "amber");
  box.line(`Registry admin/issuer; oracle admin/updater: ${hasExpectedRoles(["credential registry admin", "project issuer", "oracle admin", "oracle updater"]) ? "CONFIRMED" : "INCOMPLETE"}`, "white");
  box.line(`Token admins/minters; Lending admin/risk/pauser; 2 participants: ${expectedTokenAndLendingRoles ? "CONFIRMED" : "INCOMPLETE"}`, "white");
  box.line(`Governance admin/pauser: ${hasExpectedRoles(["governance admin", "governance pause authority"]) ? "CONFIRMED" : "INCOMPLETE"}`, "white");
  box.line(`Contract dependencies and reserves confirmed: ${dependencyChecks.length}/8`, dependencyChecks.length === 8 ? "green" : "amber");
  box.line(`Lending pool: ${exactCheck("Lending and Governance start paused") ? "PAUSED" : "STATE NOT CONFIRMED"}`, exactCheck("Lending and Governance start paused") ? "green" : "amber");
  box.line(`Governance: ${exactCheck("Lending and Governance start paused") ? "PAUSED" : "STATE NOT CONFIRMED"}`, exactCheck("Lending and Governance start paused") ? "green" : "amber");
  box.line(`Demo token supplies: ${exactCheck("tokens have zero initial supply") ? "ZERO / ZERO" : "NOT CONFIRMED"}`, exactCheck("tokens have zero initial supply") ? "green" : "amber");
  box.line(`Synthetic oracle: ${exactCheck("oracle has configured bounds but no seeded prices") ? "UNSEEDED / UNSEEDED" : "NOT CONFIRMED"}`, exactCheck("oracle has configured bounds but no seeded prices") ? "green" : "amber");
  scenes.push(box.scene());

  box.rows.push(box.border("="));
  box.line("G Y E V O  |  ROBINHOOD MAINNET 4663", "white");
  box.line(`${receiptCount}/10 deployment receipts checked  |  ${verifiedSources}/${totalSources} sources verified`, "rose");
  box.line("READ ONLY  |  NO SIGNING, DEPLOYMENT OR STATE CHANGES", "muted");
  box.rows.push(box.border("="));
  scenes.push(box.scene());
  return scenes;
}

export function renderMainnetPresentation(report, { columns = 120, color = false, colorDepth = "256", verbose = false } = {}) {
  const options = { columns, color, colorDepth };
  const scenes = report.kind === "not-deployed"
    ? buildNotDeployedScenes(report, options)
    : report.kind === "unavailable"
      ? buildUnavailableScenes(report, options)
      : report.kind === "offline-replay"
        ? buildOfflineReplayScenes(report, options)
      : buildDeployedScenes(report, options, { verbose });
  return scenes.map((scene) => scene.join("\n")).join("\n\n");
}

export async function playMainnetPresentation(report, {
  tty = Boolean(process.stdout.isTTY),
  color = false,
  colorDepth = "256",
  columns = process.stdout.columns || 120,
  verbose = false,
  write = (value) => process.stdout.write(value),
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  finalHoldMs = 2_500,
  signalTarget = process,
} = {}) {
  const options = { columns, color, colorDepth, verbose };
  const scenes = report.kind === "not-deployed"
    ? buildNotDeployedScenes(report, options)
    : report.kind === "unavailable"
      ? buildUnavailableScenes(report, options)
      : report.kind === "offline-replay"
        ? buildOfflineReplayScenes(report, options)
      : buildDeployedScenes(report, options, { verbose });
  if (!tty) {
    write(`${scenes.map((scene) => scene.join("\n")).join("\n\n")}\n`);
    return { interrupted: false, animated: false };
  }

  const controller = new AbortController();
  let interrupted = false;
  const onInterrupt = () => { interrupted = true; controller.abort(); };
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
  for (const signal of signals) signalTarget.once(signal, onInterrupt);
  let cursorHidden = false;
  try {
    write("\u001b[?25l");
    cursorHidden = true;
    for (const [sceneIndex, scene] of scenes.entries()) {
      if (interrupted) break;
      for (const row of scene) {
        if (interrupted) break;
        write(`${row}\n`);
        await pause(sceneIndex === 0 ? 110 : 75, controller.signal);
      }
      if (!interrupted && sceneIndex < scenes.length - 1) await pause(280, controller.signal);
    }
    if (!interrupted) await pause(finalHoldMs, controller.signal);
  } finally {
    if (cursorHidden) write("\u001b[0m\u001b[?25h\n");
    for (const signal of signals) signalTarget.removeListener(signal, onInterrupt);
  }
  return { interrupted, animated: true };
}

export function visibleMainnetLength(value) {
  return String(value).replace(ANSI, "").length;
}

export function mainnetPresentationColorDepth(env = process.env) {
  if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") return "truecolor";
  if ((env.TERM ?? "").includes("256color")) return "256";
  return "16";
}
