import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = "scripts/robinhood-dao2-l2fix-deploy.mjs";

describe("DAO Phase 2 L2-fix deployment guard", () => {
  test("refuses to start without explicit execution authorization", () => {
    const result = spawnSync("bun", [SCRIPT], { cwd: ROOT, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Deployment is disabled unless --execute is supplied.");
  });

  test("rejects an authorization label that does not match the replacement deployment", () => {
    const result = spawnSync("bun", [SCRIPT, "--execute", "--authorize-public-testnet-write=phase2-deploy"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Explicit authorization must equal phase2-l2-blockfix-deploy.");
  });

  test("simulation-only mode rejects execution flags before RPC access", () => {
    const result = spawnSync("bun", [SCRIPT, "--simulate", "--execute"], { cwd: ROOT, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Simulation mode rejects signer and execution options.");
  });
});
