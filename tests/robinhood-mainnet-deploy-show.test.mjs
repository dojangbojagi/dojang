import { describe, expect, test } from "bun:test";
import {
  renderMainnetPresentation,
  visibleMainnetLength,
} from "../scripts/robinhood-mainnet-deploy-show-core.mjs";

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
