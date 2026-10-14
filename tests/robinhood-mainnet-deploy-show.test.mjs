import { describe, expect, test } from "bun:test";
import {
  renderMainnetPresentation,
  playMainnetPresentation,
  visibleMainnetLength,
} from "../scripts/robinhood-mainnet-deploy-show-core.mjs";
import { runPresentation } from "../scripts/robinhood-deploy-presentation.mjs";

const mainnetContracts = {
  ZKTranscriptLib: "0xf37f9fe79bd275bd64fb4079df9e0eaaaf09994f",
  RelationsLib: "0xd593cc3e5af275827be507cccd5a0c7babac8d81",
  HonkVerifier: "0x47c9c38e4f4f79a8ce8c5ef28c8af228bec51de7",
  EligibilityVerifierAdapter: "0x311d58862576c1c8ae97c7aee6a2da17fb20e3bd",
  RobinhoodMainnetDemoCredentialRegistry: "0x161ff635c26665ee41e3941f32873e9490c4856b",
  RobinhoodMainnetDemoOracle: "0x21bb6bf7f3be2b08b1778c9b2da743621e6e3262",
  RobinhoodMainnetDemoTokenLoan: "0xfbafdf28bb402ecdafb90e3852f1494352444bc1",
  RobinhoodMainnetDemoTokenCollateral: "0xc59b87173b03b030482e5ff8234cbbfd702a49b9",
  RobinhoodMainnetDemoLendingPool: "0x8706b2fe815fb3c5986ace47b59be0853567b48d",
  RobinhoodMainnetDemoGovernancePhase1: "0x803c6f452abdb5b9a23dadba8d7e157ba55b6dea",
};

function deployedMainnetReport() {
  const names = Object.keys(mainnetContracts);
  return {
    kind: "deployed",
    chainId: 4663,
    headBlock: "88265003",
    contracts: mainnetContracts,
    successfulReceiptCount: 10,
    deploymentReceipts: names.map((name, index) => ({
      name,
      address: mainnetContracts[name],
      transactionHash: `0x${String(index + 1).padStart(64, "0")}`,
      blockNumber: "88240000",
      gasUsed: "100000",
      status: "success",
      liveBytecodeStatus: "present and matches the configured Mainnet compiler artifact",
    })),
    blockscoutSourceVerification: {
      verifiedCount: 0,
      total: 10,
      statusByContract: Object.fromEntries(names.map((name) => [name, "unavailable HTTP 403"])),
    },
    roleAndDependencyChecks: [
      ...Array.from({ length: 15 }, (_, index) => `check ${index + 1} role confirmed`),
      ...Array.from({ length: 8 }, (_, index) => `check ${index + 1} dependency confirmed`),
      "Lending and Governance start paused",
      "tokens have zero initial supply",
      "oracle has configured bounds but no seeded prices",
    ],
  };
}

describe("Robinhood Mainnet deployment presentation", () => {
  const noDeployment = { kind: "not-deployed", rpcStatus: "connected", chainId: 4663, headBlock: "123456" };

  test.each([100, 120])("fits a %i-column terminal and shows no deployment as unavailable", (columns) => {
    const output = renderMainnetPresentation(noDeployment, { columns });
    const lengths = output.split("\n").map(visibleMainnetLength);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(columns);
    expect(output).toContain("G Y E V O");
    expect(output).toContain("ROBINHOOD CHAIN MAINNET | CHAIN 4663");
    expect(output).toContain("PROJECT DEPLOYMENT: NOT DEPLOYED");
    expect(output).toContain("Public receipts checked: 0");
    expect(output).toContain("NOT DEPLOYED");
    expect(output).not.toContain("PASS");
    expect(output).not.toContain("VERIFIED");
  });

  test("plain output contains no terminal escapes and marks unverified state as unavailable", () => {
    const output = renderMainnetPresentation({ kind: "not-deployed", rpcStatus: "unavailable" }, { columns: 120, color: false });
    expect(output).not.toContain("\u001b[");
    expect(output).toContain("LIVE RPC: UNAVAILABLE");
    expect(output).toContain("Paused states, token supplies, oracle state, roles and dependencies: UNAVAILABLE");
    expect(output).not.toContain("SOURCE VERIFIED");
  });

  test("presentation mode uses the established burgundy palette", () => {
    const output = renderMainnetPresentation(noDeployment, { columns: 120, color: true, colorDepth: "truecolor" });
    expect(output).toContain("\u001b[38;2;198;56;96m");
    expect(Math.max(...output.split("\n").map(visibleMainnetLength))).toBeLessThanOrEqual(120);
  });

  test("live Mainnet presentation reuses the centered Testnet frame with compact evidence rows", () => {
    const output = renderMainnetPresentation(deployedMainnetReport(), { columns: 120 });
    const lines = output.split("\n");
    expect(Math.max(...lines.map(visibleMainnetLength))).toBeLessThanOrEqual(120);
    expect(lines[0].trim()).toMatch(/^\+={108}\+$/);
    expect(output).toContain("ROBINHOOD MAINNET | CHAIN 4663");
    expect(output).toContain("CONTROLLED DEMO DEPLOYMENT | READ ONLY");
    expect(output).toContain("01 / ZERO-KNOWLEDGE INFRASTRUCTURE 4/4");
    expect(output).toContain("02 / CREDENTIAL INFRASTRUCTURE 1/1");
    expect(output).toContain("03 / LENDING INFRASTRUCTURE 4/4");
    expect(output).toContain("04 / GOVERNANCE 1/1");
    expect(output).toContain("PASS       Public deployment receipts | 10/10");
    expect(output).toContain("PASS       Runtime bytecode matched | 10/10");
    expect(output).toContain("PASS       Access-control roles | 15/15");
    expect(output).toContain("PASS       Contract dependencies and reserves | 8/8");
    expect(output).toContain("UNAVAILABLE Blockscout source verification | 10 status checks unavailable");
    expect(output).not.toContain("0 / 10 SOURCES VERIFIED");
    expect(output).toContain("05 / MAINNET OPERATIONAL STATE");
    expect(output).toContain("Lending | PAUSED");
    expect(output).toContain("Governance | PAUSED");
    expect(output).toContain("dUSD / dCOL supply | ZERO");
    expect(output).toContain("Synthetic oracle | UNSEEDED");
    expect(output).toContain("10 / 10 BYTECODES MATCHED");
    expect(output).toContain("CONTROLLED DEMO | SYNTHETIC ASSETS");
    expect(output).toContain("READ ONLY  |  NO TRANSACTIONS SIGNED OR BROADCAST");

    const compactRows = lines.filter((line) => /DEPLOYED \/ BYTECODE MATCHED/.test(line));
    expect(compactRows).toHaveLength(10);
    expect(compactRows.every((line) => /0x[\da-f]{6}\.\.\.[\da-f]{6}/i.test(line))).toBe(true);
    expect(output).not.toContain(mainnetContracts.ZKTranscriptLib);
    expect(output).not.toContain(mainnetContracts.RobinhoodMainnetDemoGovernancePhase1);

    const wordmarkRows = lines.filter((line) => line.includes("GYEVO"));
    expect(wordmarkRows.length).toBeGreaterThanOrEqual(2);
    expect(wordmarkRows.every((line) => line.indexOf("GYEVO") > line.indexOf("| "))).toBe(true);
  });

  test("Mainnet presentation uses the same finite reveal pacing as Testnet", async () => {
    const mainnetWaits = [];
    const testnetWaits = [];
    const mainnetWrites = [];
    const testnetWrites = [];
    const mainnet = await playMainnetPresentation(deployedMainnetReport(), {
      tty: true,
      columns: 120,
      write: (value) => mainnetWrites.push(value),
      pause: async (ms) => mainnetWaits.push(ms),
      finalHoldMs: 5_000,
    });
    await runPresentation({
      chainId: 46630,
      head: 1n,
      verified: [],
      verificationByName: new Map(),
      calls: [],
      initReceipts: [],
      deploymentReceiptCount: 0,
      governance: { proposalOneExecuted: false, proposalOneState: "N/A", minimumRemainingValidity: "N/A" },
      oracleStates: [
        { name: "rUSD2", state: "missing", ageSeconds: 0, maxAge: 0 },
        { name: "rCOL2", state: "missing", ageSeconds: 0, maxAge: 0 },
      ],
    }, {
      tty: true,
      columns: 120,
      write: (value) => testnetWrites.push(value),
      pause: async (ms) => testnetWaits.push(ms),
      finalHoldMs: 5_000,
    });
    expect(mainnet.animated).toBe(true);
    expect(mainnetWaits).toEqual(testnetWaits);
    expect(mainnetWrites.join("")).toContain("GYEVO");
    expect(mainnetWrites.join("")).toContain("ROBINHOOD MAINNET | CHAIN 4663");
  });

  test("does not treat local Foundry entries as public deployments when live validation fails", () => {
    const output = renderMainnetPresentation({
      kind: "unavailable",
      localTransactionCount: 10,
      error: "RPC unavailable",
    }, { columns: 120, color: false });
    expect(Math.max(...output.split("\n").map(visibleMainnetLength))).toBeLessThanOrEqual(120);
    expect(output).toContain("Project deployment status: UNVERIFIED");
    expect(output).toContain("10 entries; these are not public receipts");
    expect(output).toContain("LIVE STATUS UNAVAILABLE");
    expect(output).not.toContain("DEPLOYED");
    expect(output).not.toContain("SOURCE VERIFIED");
  });
});
