import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import {
  presentationColorDepth,
  renderPresentation,
  renderPresentationFailure,
  runPresentation,
  safePresentationError,
  visibleLength,
} from "../scripts/robinhood-deploy-presentation.mjs";

const names = [
  "ZKTranscriptLib", "RelationsLib", "HonkVerifier", "EligibilityVerifierAdapter",
  "RobinhoodDemoCredentialRegistry", "ControlledTestOracle", "rUSD2", "rCOL2",
  "LendingPoolV2", "RobinhoodGovernancePhase1",
];
const addresses = [
  "0xa8e694A6449237a6deE4EC3847D11c2d9b484B21", "0xfa7674DEFbE554477176628AD8aB36Fe5d8b83E5",
  "0xEEB12913D55bfFd1DE762BDe4250c5f0B0072D61", "0x069C8C36a426Be42fC227aD5eEc7c6772BFA191b",
  "0x997F3415e83fFc37c29D142fF6f1c6D624E3D3a5", "0xEd60bF3276c4d520cBF81FA480435817EAD6c1E1",
  "0x1b52f1F2BA6CF870415e207861C6f33DD3d5Ea0F", "0xB5c97153Dca052636eD692A9e17A9698Ca70160C",
  "0x3FA7bdC06E4f3134E271ff9046561A6667b1718e", "0x011EDe60AB460AF00E082e2086D0745B6a1B23D0",
];

function verifiedReport() {
  return {
    chainId: 46630,
    head: 134_200_000n,
    verified: names.map((name, index) => ({ name, address: addresses[index] })),
    verificationByName: new Map(names.map((name) => [name, "source verified"])),
    calls: Array.from({ length: 5 }, (_, index) => ({ hash: `initialization-${index + 1}` })),
    initReceipts: Array.from({ length: 5 }, (_, index) => ({ entry: { hash: `initialization-${index + 1}` } })),
    deploymentReceiptCount: 15,
    governance: {
      proposalOneExecuted: true,
      proposalOneState: "STATE 6",
      minimumRemainingValidity: "3600",
    },
    oracleStates: [
      { name: "rUSD2", state: "stale", ageSeconds: 36_000, maxAge: 3_600 },
      { name: "rCOL2", state: "fresh", ageSeconds: 600, maxAge: 3_600 },
    ],
  };
}

describe("Robinhood historical deployment presentation", () => {
  test.each([100, 120, 80])("keeps every displayed line within %i terminal columns", (columns) => {
    const output = renderPresentation(verifiedReport(), { columns });
    const lengths = output.split("\n").map((line) => visibleLength(line));
    expect(Math.max(...lengths)).toBeLessThanOrEqual(columns);
  });

  test("shows the large brand, verified deployment, executed governance and separate oracle readiness", () => {
    const output = renderPresentation(verifiedReport(), { columns: 100 });
    expect(output).toContain("G Y E V O");
    expect([...output].every((character) => character.charCodeAt(0) < 128)).toBe(true);
    expect(output).toContain("HISTORICAL DEPLOYMENT REPLAY  |  READ ONLY");
    expect(output).toContain("10 / 10 CONTRACTS DEPLOYED");
    expect(output).toContain("10 / 10 SOURCES VERIFIED");
    expect(output).toContain("DAO Proposal #1  |  EXECUTED");
    expect(output).toContain("Minimum credential validity  |  3600s");
    expect(output).toContain("rUSD2    STALE");
    expect(output).toContain("Deployment evidence  |  15/15 successful receipts checked");
  });

  test("does not promote unavailable explorer data to verified", () => {
    const report = verifiedReport();
    report.verificationByName.set("RobinhoodGovernancePhase1", "unavailable (timeout)");
    const output = renderPresentation(report, { columns: 120 });
    expect(output).toContain("9/10 verified, 0 not verified, 1 unavailable");
    expect(output).toContain("9 / 10 SOURCES VERIFIED");
    expect(output).toContain("SOURCE UNAVAILABLE");
    expect(output).not.toContain("10 / 10 SOURCES VERIFIED");
  });

  test("keeps terminal control escapes out of non-TTY and failure output", async () => {
    const chunks = [];
    const rendered = await runPresentation(verifiedReport(), {
      tty: false,
      color: false,
      columns: 100,
      write: (chunk) => chunks.push(chunk),
    });
    expect(rendered.animated).toBe(false);
    expect(chunks.join("")).not.toContain("\u001b[");
    expect(renderPresentationFailure("RPC unavailable", { columns: 100 })).not.toContain("\u001b[");
  });

  test("uses a finite roughly 20–30 second sequence and restores the cursor", async () => {
    const writes = [];
    const waits = [];
    const signalTarget = new EventEmitter();
    const result = await runPresentation(verifiedReport(), {
      tty: true,
      color: true,
      colorDepth: "truecolor",
      columns: 120,
      write: (chunk) => writes.push(chunk),
      pause: async (duration) => waits.push(duration),
      signalTarget,
      finalHoldMs: 5_000,
    });
    const totalDuration = waits.reduce((sum, duration) => sum + duration, 0);
    expect(result.animated).toBe(true);
    expect(result.interrupted).toBe(false);
    expect(totalDuration).toBeGreaterThanOrEqual(20_000);
    expect(totalDuration).toBeLessThanOrEqual(30_000);
    expect(waits.at(-1)).toBe(5_000);
    expect(writes[0]).toBe("\u001b[?25l");
    expect(writes.some((chunk) => chunk.startsWith("\r     "))).toBe(true);
    expect(writes.at(-1)).toContain("\u001b[?25h");
    expect(writes.join("")).toContain("\u001b[38;2;198;56;96m");
  });

  test("restores the cursor and removes signal handlers after interruption", async () => {
    const writes = [];
    const signalTarget = new EventEmitter();
    const result = await runPresentation(verifiedReport(), {
      tty: true,
      color: false,
      write: (chunk) => writes.push(chunk),
      pause: async () => signalTarget.emit("SIGINT"),
      signalTarget,
    });
    expect(result.interrupted).toBe(true);
    expect(writes[0]).toBe("\u001b[?25l");
    expect(writes.at(-1)).toContain("\u001b[?25h");
    expect(signalTarget.listenerCount("SIGINT")).toBe(0);
    expect(signalTarget.listenerCount("SIGTERM")).toBe(0);
    expect(signalTarget.listenerCount("SIGHUP")).toBe(0);
  });

  test("uses terminal color fallbacks and redacts RPC URLs from errors", () => {
    expect(presentationColorDepth({ COLORTERM: "truecolor" })).toBe("truecolor");
    expect(presentationColorDepth({ TERM: "xterm-256color" })).toBe("256");
    expect(presentationColorDepth({ TERM: "xterm" })).toBe("16");
    expect(safePresentationError("request failed at https://secret.example/rpc/key", {})).toContain("[endpoint]");
    expect(safePresentationError("request failed at https://private/key", { RH_TESTNET_RPC_URL: "https://private/key" }))
      .toBe("request failed at [RPC endpoint]");
  });
});
