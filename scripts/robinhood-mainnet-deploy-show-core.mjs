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

function bytecodeMatched(receipt) {
  const status = receipt?.liveBytecodeStatus;
  return status === true || (typeof status === "string" && /\bmatch(?:ed|es)?\b/i.test(status) && !/not\s+match|mismatch|unavailable/i.test(status));
}

function mainnetVisualReport(report) {
  const verified = [];
  const verificationByName = new Map();
  for (const entry of TESTNET_VISUAL_CONTRACTS) {
    const address = report.contracts?.[entry.mainnetName];
    if (address) verified.push({ name: entry.visualName, address });
    const status = report.blockscoutSourceVerification?.statusByContract?.[entry.mainnetName];
    verificationByName.set(entry.visualName,
      status === "verified" ? "source verified"
        : status === "not verified" ? "source not verified"
          : "source status unavailable");
  }
  const checks = report.roleAndDependencyChecks ?? [];
  const zeroSupply = checks.some((check) => check.includes("tokens have zero initial supply"));
  const oracleUnseeded = checks.some((check) => check.includes("oracle has configured bounds but no seeded prices"));
  return {
    chainId: report.chainId,
    head: report.headBlock,
    verified,
    verificationByName,
    calls: [],
    initReceipts: [],
    deploymentReceiptCount: report.successfulReceiptCount ?? 0,
    governance: {
      proposalOneExecuted: false,
      proposalOneState: "not reported for Mainnet",
      minimumRemainingValidity: "not reported",
    },
    oracleStates: [
      { name: "dUSD / dCOL supply", state: zeroSupply ? "missing" : "unknown", ageSeconds: 0, maxAge: 0 },
      { name: "Synthetic oracle", state: oracleUnseeded ? "missing" : "unknown", ageSeconds: 0, maxAge: 0 },
    ],
  };
}

function liveMainnetFacts(report) {
  const checks = report.roleAndDependencyChecks ?? [];
  const sourceStatuses = Object.values(report.blockscoutSourceVerification?.statusByContract ?? {});
  const verifiedSources = sourceStatuses.filter((status) => status === "verified").length;
  const unverifiedSources = sourceStatuses.filter((status) => status === "not verified").length;
  const unavailableSources = sourceStatuses.filter((status) => String(status).startsWith("unavailable")).length;
  const receipts = report.deploymentReceipts ?? [];
  const bytecodeCount = receipts.filter(bytecodeMatched).length;
  const roleCount = checks.filter((item) => item.includes(" role confirmed")).length;
  const dependencyCount = checks.filter((item) => item.includes("dependency confirmed") || item.includes("reserve addresses confirmed")).length;
  const exactCheck = (fragment) => checks.some((item) => item.includes(fragment));
  return {
    receiptCount: report.successfulReceiptCount ?? receipts.filter((receipt) => receipt.status === "success").length,
    bytecodeCount,
    roleCount,
    dependencyCount,
    verifiedSources,
    unverifiedSources,
    unavailableSources,
    paused: exactCheck("Lending and Governance start paused"),
    zeroSupply: exactCheck("tokens have zero initial supply"),
    oracleUnseeded: exactCheck("oracle has configured bounds but no seeded prices"),
  };
}

function transformedContent(text, report, facts, state) {
  if (text === "G Y E V O") return { lines: ["GYEVO"], tone: "white" };
  if (text === "ROBINHOOD TESTNET  |  CHAIN 46630") return { lines: ["ROBINHOOD MAINNET | CHAIN 4663"], tone: "rose" };
  if (text === "HISTORICAL DEPLOYMENT REPLAY  |  READ ONLY") return { lines: ["CONTROLLED DEMO DEPLOYMENT | READ ONLY"], tone: "muted" };
  if (text === "01  /  LIVE ON-CHAIN VALIDATION") return { lines: ["01 / LIVE MAINNET VALIDATION"], tone: "rose" };
  if (text === "05  /  GOVERNANCE & PROTOCOL EVIDENCE") return { lines: ["05 / MAINNET OPERATIONAL STATE"], tone: "rose" };
  if (/^\d{2}\s+\/\s+/.test(text)) return { lines: [text.replace(/\s{2,}/g, " ")] };

  if (text.startsWith("PASS") && text.includes("RPC connected")) {
    return { lines: ["PASS       RPC connected | Robinhood Mainnet 4663"], tone: "rose" };
  }
  if (text.startsWith("PASS") && text.includes("Network identified")) {
    return { lines: [`PASS       Lending and Governance | ${facts.paused ? "PAUSED" : "STATE NOT CONFIRMED"}`], tone: facts.paused ? "rose" : "muted" };
  }
  if (text.startsWith("PASS") && text.includes("Public receipts")) {
    return { lines: [`PASS       Public deployment receipts | ${facts.receiptCount}/10`], tone: "rose" };
  }
  if (text.startsWith("PASS") && text.includes("Runtime bytecode")) {
    return { lines: [`PASS       Runtime bytecode matched | ${facts.bytecodeCount}/10`], tone: facts.bytecodeCount === 10 ? "rose" : "muted" };
  }
  if (text.includes("Blockscout sources")) {
    let summary;
    let tone = "muted";
    if (facts.unavailableSources === 10 && facts.verifiedSources === 0 && facts.unverifiedSources === 0) {
      summary = "UNAVAILABLE Blockscout source verification | 10 status checks unavailable";
    } else if (facts.unavailableSources > 0) {
      summary = `PARTIAL Blockscout source verification | ${facts.verifiedSources} verified, ${facts.unverifiedSources} not verified, ${facts.unavailableSources} unavailable`;
    } else if (facts.verifiedSources === 10) {
      summary = "PASS       Blockscout source verification | 10/10 verified";
      tone = "rose";
    } else {
      summary = `INCOMPLETE Blockscout source verification | ${facts.verifiedSources} verified, ${facts.unverifiedSources} not verified`;
    }
    return { lines: [summary], tone };
  }
  if (text.startsWith("PASS") && text.includes("Dependencies, roles, reserves")) {
    return {
      lines: [
        `PASS       Access-control roles | ${facts.roleCount}/15`,
        `PASS       Contract dependencies and reserves | ${facts.dependencyCount}/8`,
      ],
      tone: "rose",
    };
  }

  const contractRow = text.match(/^([A-Za-z0-9]+)\s+(0x[\da-fA-F]{6}\.\.\.[\da-fA-F]{6})\s+(DEPLOYED|NOT CONFIRMED)\s*\/\s*SOURCE.*$/);
  if (contractRow) {
    const entry = VISUAL_CONTRACT_BY_NAME.get(contractRow[1]);
    if (entry) {
      const receipt = report.deploymentReceipts?.find((record) => record.name === entry.mainnetName);
      const matched = bytecodeMatched(receipt);
      const deployed = receipt?.status === "success";
      const address = report.contracts?.[entry.mainnetName];
      const short = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "address unavailable";
      return {
        lines: [`${entry.label.padEnd(40)} ${short.padEnd(18)} ${deployed ? "DEPLOYED" : "NOT CONFIRMED"} / ${matched ? "BYTECODE MATCHED" : "BYTECODE NOT CONFIRMED"}`],
        tone: deployed && matched ? "rose" : "muted",
      };
    }
  }

  if (text.startsWith("DAO Proposal #1")) return { lines: [`Runtime bytecode matched | ${facts.bytecodeCount}/10`], tone: "rose" };
  if (text.startsWith("Minimum credential validity")) return { lines: [`Access-control role checks | ${facts.roleCount}/15`], tone: "rose" };
  if (text.startsWith("Deployment evidence")) return { lines: [`Dependencies and reserves | ${facts.dependencyCount}/8`], tone: "rose" };
  if (text.startsWith("Source verification")) return { lines: [`Lending | ${facts.paused ? "PAUSED" : "STATE NOT CONFIRMED"}`], tone: facts.paused ? "rose" : "muted" };
  if (text.startsWith("ORACLE READINESS")) return { lines: [`Governance | ${facts.paused ? "PAUSED" : "STATE NOT CONFIRMED"}`], tone: facts.paused ? "rose" : "muted" };
  if (text.startsWith("dUSD / dCOL supply")) return { lines: [`dUSD / dCOL supply | ${facts.zeroSupply ? "ZERO" : "NOT CONFIRMED"}`], tone: facts.zeroSupply ? "rose" : "muted" };
  if (text.startsWith("Synthetic oracle")) return { lines: [`Synthetic oracle | ${facts.oracleUnseeded ? "UNSEEDED" : "STATE NOT CONFIRMED"}`], tone: facts.oracleUnseeded ? "rose" : "muted" };

  if (/^\d+ \/ 10 SOURCES VERIFIED$/.test(text)) {
    return { lines: [`${facts.bytecodeCount} / 10 BYTECODES MATCHED`], tone: facts.bytecodeCount === 10 ? "rose" : "muted" };
  }
  if (text === "PRIVATE ELIGIBILITY. PUBLIC EXECUTION.") {
    state.taglineOccurrences += 1;
    if (state.taglineOccurrences === 2) return { lines: ["ROBINHOOD MAINNET | CHAIN 4663"], tone: "rose" };
  }
  if (text === "Historical deployment verified on Robinhood Testnet.") {
    return { lines: ["CONTROLLED DEMO | SYNTHETIC ASSETS"], tone: "rose" };
  }
  return { lines: [text] };
}

function createMainnetTextTransformer(report, { columns = 120, color = false, colorDepth = "256" } = {}) {
  const facts = liveMainnetFacts(report);
  const width = Math.max(32, Math.min(110, Math.floor(columns) - 2));
  const innerWidth = width - 4;
  const state = { taglineOccurrences: 0 };
  return (chunk) => String(chunk).split(/(\n)/).map((part) => {
    if (part === "\n" || part.length === 0) return part;
    const plain = part.replace(ANSI, "");
    const frame = plain.match(/^(\s*\| )(.*) \|$/);
    if (!frame) return part;
    const visibleInner = frame[2];
    const text = visibleInner.trim();
    if (!text) return part;
    const transformed = transformedContent(text, report, facts, state);
    const centered = visibleInner.startsWith(" ");
    const originalPrefix = frame[1];
    const originalColor = part.slice(originalPrefix.length).match(/^\u001b\[[0-9;]*m/)?.[0] ?? "";
    const rows = transformed.lines.flatMap((value) => {
      const wrapped = value.length <= innerWidth ? [value] : wrap(value, innerWidth);
      return wrapped.map((line) => {
        const left = centered ? Math.floor((innerWidth - line.length) / 2) : 0;
        const padded = `${" ".repeat(Math.max(0, left))}${line}${" ".repeat(Math.max(0, innerWidth - left - line.length))}`;
        const painted = transformed.tone
          ? colorize(padded, transformed.tone, color, colorDepth)
          : originalColor ? `${originalColor}${padded}\u001b[0m` : padded;
        return `${originalPrefix}${painted} |`;
      });
    });
    return rows.join("\n");
  }).join("");
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
  if (report.kind === "deployed") {
    const compatibleReport = mainnetVisualReport(report);
    const output = renderTestnetPresentation(compatibleReport, options);
    return createMainnetTextTransformer(report, options)(output);
  }
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
  if (report.kind === "deployed") {
    const compatibleReport = mainnetVisualReport(report);
    const transform = createMainnetTextTransformer(report, { columns, color, colorDepth });
    return runTestnetPresentation(compatibleReport, {
      tty,
      color,
      colorDepth,
      columns,
      write: (chunk) => write(transform(chunk)),
      pause,
      finalHoldMs,
      signalTarget,
    });
  }
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
