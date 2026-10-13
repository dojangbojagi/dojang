const GROUPS = [
  ["ZERO-KNOWLEDGE INFRASTRUCTURE", ["ZKTranscriptLib", "RelationsLib", "HonkVerifier", "EligibilityVerifierAdapter"]],
  ["CREDENTIAL INFRASTRUCTURE", ["RobinhoodDemoCredentialRegistry"]],
  ["LENDING INFRASTRUCTURE", ["ControlledTestOracle", "rUSD2", "rCOL2", "LendingPoolV2"]],
  ["GOVERNANCE", ["RobinhoodGovernancePhase1"]],
];

const LOGO_GLYPHS = [
  ["  ####  ", " ##     ", "##  ### ", "##    ##", " ###### "],
  ["##    ##", " ##  ## ", "  ####  ", "   ##   ", "   ##   "],
  ["########", "##      ", "######  ", "##      ", "########"],
  ["##    ##", "##    ##", " ##  ## ", " ##  ## ", "  ####  "],
  ["  ####  ", " ##  ## ", "##    ##", " ##  ## ", "  ####  "],
];
const LOGO = Array.from({ length: LOGO_GLYPHS[0].length }, (_, row) =>
  LOGO_GLYPHS.map((glyph) => glyph[row]).join("  "));

const PALETTE = {
  burgundy: { rgb: [198, 56, 96], ansi256: 168, ansi16: 91 },
  rose: { rgb: [225, 138, 164], ansi256: 217, ansi16: 97 },
  white: { rgb: [244, 237, 239], ansi256: 255, ansi16: 97 },
  muted: { rgb: [185, 163, 169], ansi256: 181, ansi16: 90 },
};

function visibleLength(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "").length;
}

function wrapText(value, maxWidth) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  const rows = [];
  let row = "";
  for (const word of words) {
    if (word.length > maxWidth) {
      if (row) rows.push(row);
      row = "";
      for (let offset = 0; offset < word.length; offset += maxWidth) {
        rows.push(word.slice(offset, offset + maxWidth));
      }
      continue;
    }
    if (!row) row = word;
    else if (row.length + word.length + 1 <= maxWidth) row += ` ${word}`;
    else {
      rows.push(row);
      row = word;
    }
  }
  if (row) rows.push(row);
  return rows.length ? rows : [""];
}

function colorize(value, tone, color, colorDepth = "256") {
  if (!color || !PALETTE[tone]) return value;
  const palette = PALETTE[tone];
  const open = colorDepth === "truecolor"
    ? `\u001b[38;2;${palette.rgb.join(";")}m`
    : colorDepth === "16"
      ? `\u001b[${palette.ansi16}m`
      : `\u001b[38;5;${palette.ansi256}m`;
  return `${open}${value}\u001b[0m`;
}

function shortAddress(address) {
  return address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "address unavailable";
}

function sourceCount(verificationByName) {
  const statuses = [...verificationByName.values()];
  return {
    verified: statuses.filter((status) => status === "source verified").length,
    notVerified: statuses.filter((status) => status.startsWith("source not verified")).length,
    unavailable: statuses.filter((status) => !status.startsWith("source verified") && !status.startsWith("source not verified")).length,
  };
}

function makeScenes(report, { columns = 100, color = false, colorDepth = "256" } = {}) {
  const terminalWidth = Math.max(34, Math.floor(columns));
  const width = Math.max(32, Math.min(110, terminalWidth - 2));
  const innerWidth = width - 4;
  const indent = " ".repeat(Math.max(0, Math.floor((terminalWidth - width) / 2)));
  const lines = [];
  const center = (value = "") => {
    const content = String(value);
    if (content.length <= innerWidth) {
      const pad = Math.floor((innerWidth - content.length) / 2);
      return [`${" ".repeat(pad)}${content}${" ".repeat(innerWidth - pad - content.length)}`];
    }
    return wrapText(content, innerWidth).map((text) => {
      const pad = Math.floor((innerWidth - text.length) / 2);
      return `${" ".repeat(pad)}${text}${" ".repeat(innerWidth - pad - text.length)}`;
    });
  };
  const left = (value = "") => {
    const content = String(value);
    const rows = content.length <= innerWidth ? [content] : wrapText(content, innerWidth);
    return rows.map((text) => `${text}${" ".repeat(Math.max(0, innerWidth - text.length))}`);
  };
  const border = (char = "-") => `+${char.repeat(width - 2)}+`;
  const box = (content = "", align = "left", tone = "white") => {
    const rows = align === "center" ? center(content) : left(content);
    return rows.map((inner) => `| ${colorize(inner, tone, color, colorDepth)} |`).join("\n");
  };
  const header = (title) => [
    colorize(border(), "burgundy", color, colorDepth),
    box(title, "left", "rose"),
    colorize(border(), "burgundy", color, colorDepth),
  ];

  const welcome = [
    colorize(border("="), "burgundy", color, colorDepth),
    box("", "center"),
    box("G Y E V O", "center", "white"),
    ...LOGO.map((row) => box(row, "center", "rose")),
    box("PRIVATE ELIGIBILITY. PUBLIC EXECUTION.", "center", "white"),
    box("ROBINHOOD TESTNET  |  CHAIN 46630", "center", "rose"),
    box("HISTORICAL DEPLOYMENT REPLAY  |  READ ONLY", "center", "muted"),
    colorize(border("="), "burgundy", color, colorDepth),
  ];
  lines.push(welcome);

  const counts = sourceCount(report.verificationByName);
  const creationCount = report.verified.length;
  const initializationCount = report.initReceipts.length;
  const checkRows = [
    ["PASS", `RPC connected  |  block ${report.head}`, "rose"],
    ["PASS", `Network identified  |  Robinhood Testnet ${report.chainId}`, "rose"],
    ["PASS", `Public receipts  |  ${creationCount}/10 creations, ${initializationCount}/${report.calls.length} initialization`, "rose"],
    ["PASS", `Runtime bytecode  |  ${creationCount}/10 contracts present`, "rose"],
    [counts.verified === 10 ? "VERIFIED" : counts.unavailable > 0 ? "LIVE UNKNOWN" : "INCOMPLETE",
      `Blockscout sources  |  ${counts.verified}/10 verified, ${counts.notVerified} not verified, ${counts.unavailable} unavailable`,
      counts.verified === 10 ? "rose" : "muted"],
    ["PASS", "Dependencies, roles, reserves and governance read back", "rose"],
  ];
  lines.push([
    ...header("01  /  LIVE ON-CHAIN VALIDATION"),
    box("Each status below comes from this run's RPC or explorer readback.", "left", "muted"),
    ...checkRows.map(([status, detail, tone]) => box(`${status.padEnd(11)} ${detail}`, "left", tone)),
    colorize(border(), "burgundy", color, colorDepth),
  ]);

  const byName = new Map(report.verified.map((record) => [record.name, record]));
  for (const [index, [groupName, names]] of GROUPS.entries()) {
    const deployedInGroup = names.filter((name) => byName.has(name)).length;
    const groupRows = [
      ...header(`${String(index + 1).padStart(2, "0")}  /  ${groupName}  ${deployedInGroup}/${names.length}`),
      ...names.map((name) => {
        const record = byName.get(name);
        const source = report.verificationByName.get(name) ?? "source status unavailable";
        const sourceText = source === "source verified"
          ? "SOURCE VERIFIED"
          : source.startsWith("source not verified")
            ? "SOURCE NOT VERIFIED"
            : "SOURCE UNAVAILABLE";
        const status = record ? "DEPLOYED" : "NOT CONFIRMED";
        const address = record ? shortAddress(record.address) : "";
        const text = `${name.padEnd(32)} ${address.padEnd(18)} ${status} / ${sourceText}`;
        return box(text, "left", record && source === "source verified" ? "rose" : "muted");
      }),
      colorize(border(), "burgundy", color, colorDepth),
    ];
    lines.push(groupRows);
  }

  const governanceState = report.governance.proposalOneExecuted ? "EXECUTED" : report.governance.proposalOneState;
  const evidenceRows = [
    `DAO Proposal #1  |  ${governanceState}`,
    `Minimum credential validity  |  ${report.governance.minimumRemainingValidity}s`,
    `Deployment evidence  |  ${creationCount + initializationCount}/${report.deploymentReceiptCount} successful receipts checked`,
    `Source verification  |  ${counts.verified}/10 contracts verified by Blockscout`,
  ];
  lines.push([
    ...header("05  /  GOVERNANCE & PROTOCOL EVIDENCE"),
    ...evidenceRows.map((row) => box(row, "left", "rose")),
    box("ORACLE READINESS IS OPERATIONAL STATE, SEPARATE FROM DEPLOYMENT.", "left", "muted"),
    ...report.oracleStates.map((state) => {
      const value = state.state === "missing"
        ? "price not initialized"
        : `${state.ageSeconds}s old / max ${state.maxAge}s`;
      return box(`${state.name.padEnd(8)} ${state.state.toUpperCase().padEnd(8)} ${value}`, "left", state.state === "fresh" ? "rose" : "muted");
    }),
    colorize(border(), "burgundy", color, colorDepth),
  ]);

  const finalSource = counts.verified === 10 ? "10 / 10 SOURCES VERIFIED" : `${counts.verified} / 10 SOURCES VERIFIED`;
  const final = [
    colorize(border("="), "burgundy", color, colorDepth),
    box("", "center"),
    box("G Y E V O", "center", "white"),
    ...LOGO.map((row) => box(row, "center", "rose")),
    box(`${creationCount} / 10 CONTRACTS DEPLOYED`, "center", "white"),
    box(finalSource, "center", counts.verified === 10 ? "rose" : "muted"),
    box("PRIVATE ELIGIBILITY. PUBLIC EXECUTION.", "center", "white"),
    box("Historical deployment verified on Robinhood Testnet.", "center", "rose"),
    box("READ ONLY  |  NO TRANSACTIONS SIGNED OR BROADCAST", "center", "muted"),
    colorize(border("="), "burgundy", color, colorDepth),
  ];
  lines.push(final);

  const centeredScenes = lines.map((scene) => scene.map((line) =>
    line.split("\n").map((row) => `${indent}${row}`).join("\n")));
  return { scenes: centeredScenes, width, indent };
}

export function renderPresentation(report, options = {}) {
  return makeScenes(report, options).scenes.map((scene) => scene.join("\n")).join("\n\n");
}

export function renderPresentationFailure(message, { columns = 100, color = false, colorDepth = "256" } = {}) {
  const width = Math.max(52, Math.min(94, Math.floor(columns) - 2));
  const innerWidth = width - 4;
  const border = `+${"-".repeat(width - 2)}+`;
  const content = [
    "GYEVO",
    "ROBINHOOD TESTNET  |  CHAIN 46630",
    "HISTORICAL DEPLOYMENT REPLAY  |  READ ONLY",
    "",
    "LIVE VALIDATION UNAVAILABLE",
    "No deployment or source status is being reported as current.",
  ];
  const rows = content.flatMap((value, index) => wrapText(value, innerWidth).map((text) => {
    const padded = `| ${text.padEnd(innerWidth)} |`;
    return colorize(padded, index === 4 ? "muted" : index === 0 ? "rose" : "white", color, colorDepth);
  }));
  rows.push(...wrapText(message, innerWidth).map((text) => colorize(`| ${text.padEnd(innerWidth)} |`, "white", color, colorDepth)));
  return [colorize(border, "burgundy", color, colorDepth), ...rows, colorize(border, "burgundy", color, colorDepth)].join("\n");
}

function makeProgressBar(width, filled) {
  return `+${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled - 2))}+`;
}

function delay(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let timer;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = () => finish();
    timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Play validated read-only results as a finite terminal sequence. */
export async function runPresentation(report, {
  tty = Boolean(process.stdout.isTTY),
  color = false,
  colorDepth = "256",
  columns = process.stdout.columns || 100,
  write = (value) => process.stdout.write(value),
  pause = delay,
  finalHoldMs = 5_000,
  signalTarget = process,
} = {}) {
  const { scenes, width, indent } = makeScenes(report, { columns, color, colorDepth });
  if (!tty) {
    write(`${scenes.map((scene) => scene.join("\n")).join("\n\n")}\n`);
    return { animated: false, interrupted: false, width };
  }

  const controller = new AbortController();
  let interrupted = false;
  let cursorHidden = false;
  const interruptSignals = ["SIGINT", "SIGTERM", "SIGHUP"];
  const onInterrupt = () => {
    interrupted = true;
    controller.abort();
  };
  for (const signal of interruptSignals) signalTarget.once(signal, onInterrupt);

  try {
    write("\u001b[?25l");
    cursorHidden = true;
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
      if (interrupted) break;
      const scene = scenes[sceneIndex];
      for (const [lineIndex, line] of scene.entries()) {
        if (interrupted) break;
        if (sceneIndex === 1 && lineIndex === 0) {
          for (let step = 1; step <= 5; step += 1) {
            if (interrupted) break;
            const bar = makeProgressBar(width, Math.floor((width - 2) * step / 5));
            write(`\r${indent}${colorize(bar, "burgundy", color, colorDepth)}`);
            await pause(90, controller.signal);
          }
          if (!interrupted) write("\n");
        }
        if (interrupted) break;
        write(`${line}\n`);
        const lineDelay = sceneIndex === 0
          ? 180
          : sceneIndex === 1 || sceneIndex === 6
            ? 250
            : sceneIndex === 7
              ? 200
              : 125;
        await pause(lineDelay, controller.signal);
      }
      if (!interrupted && sceneIndex < scenes.length - 1) await pause(sceneIndex === 0 ? 650 : 300, controller.signal);
    }
    if (!interrupted) await pause(finalHoldMs, controller.signal);
  } finally {
    if (cursorHidden) write("\u001b[0m\u001b[?25h\n");
    for (const signal of interruptSignals) signalTarget.removeListener(signal, onInterrupt);
  }

  return { animated: true, interrupted, width };
}

export function presentationColorDepth(env = process.env) {
  if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") return "truecolor";
  if ((env.TERM ?? "").includes("256color")) return "256";
  return "16";
}

export function safePresentationError(message, env = process.env) {
  let safe = String(message ?? "Read-only verification failed");
  for (const key of ["RH_TESTNET_RPC_URL", "NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL"]) {
    const value = env[key];
    if (value) safe = safe.replaceAll(value, "[RPC endpoint]");
  }
  return safe.replace(/https?:\/\/[^\s)]+/gi, "[endpoint]").replace(/[\r\n]+/g, " ").slice(0, 140);
}

export { visibleLength };
