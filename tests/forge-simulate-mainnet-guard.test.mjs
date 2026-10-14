import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const script = "scripts/forge-simulate.sh";
const target = "script/DeployRobinhoodMainnetDemoStack.s.sol:DeployRobinhoodMainnetDemoStack";
const profile = ["--profile", "robinhood_mainnet"];

function run(args, extraEnv = {}) {
  return spawnSync("bash", [script, target, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

function withRpcFixtures(callback) {
  const directory = mkdtempSync(join(tmpdir(), "gyevo-mainnet-rpc-test-"));
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const castState = join(directory, "cast-count");
  const forgeState = join(directory, "forge-count");
  writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  try {
    return callback({ directory, bin, castState, forgeState });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runWithRpcFixtures(fixture, castBody, forgeBody) {
  writeFileSync(join(fixture.bin, "cast"), `#!/bin/bash\n${castBody}\n`, { mode: 0o755 });
  writeFileSync(join(fixture.bin, "forge"), `#!/bin/bash\n${forgeBody}\n`, { mode: 0o755 });
  return spawnSync("bash", [script, target, ...profile, "--chain-id", "4663", "--rpc-timeout", "20", "--rpc-url", "https://fixture.invalid"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      RH_MAINNET_RPC_URL: "https://fixture.invalid",
      CAST_STATE_FILE: fixture.castState,
      FORGE_STATE_FILE: fixture.forgeState,
    },
  });
}

describe("Robinhood Mainnet demo simulation guard", () => {
  test("requires an explicit Mainnet RPC URL", () => {
    const result = run([...profile, "--chain-id", "4663", "--rpc-url", ""], { RH_MAINNET_RPC_URL: "" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("requires RH_MAINNET_RPC_URL");
  });

  test("rejects omitted and substituted chain IDs before RPC access", () => {
    const missing = run([...profile, "--rpc-url", "https://example.invalid"], {
      RH_MAINNET_RPC_URL: "https://example.invalid",
    });
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain("pass --chain-id 4663");

    const substituted = run([...profile, "--chain-id", "46630", "--rpc-url", "https://example.invalid"], {
      RH_MAINNET_RPC_URL: "https://example.invalid",
    });
    expect(substituted.status).toBe(2);
    expect(substituted.stderr).toContain("requires explicit --chain-id 4663");
  });

  test("rejects broadcast flags for the Mainnet stack", () => {
    const result = run([...profile, "--chain-id", "4663", "--broadcast"], {
      RH_MAINNET_RPC_URL: "https://example.invalid",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("refuses broadcast");
  });

  test("retries transient chain-ID and simulation transport failures once, then succeeds", () => {
    withRpcFixtures((fixture) => {
      const result = runWithRpcFixtures(
        fixture,
        'n=$(($(cat "$CAST_STATE_FILE" 2>/dev/null || echo 0) + 1)); echo "$n" > "$CAST_STATE_FILE"; if [ "$n" -eq 1 ]; then exit 1; fi; echo 4663',
        'n=$(($(cat "$FORGE_STATE_FILE" 2>/dev/null || echo 0) + 1)); echo "$n" > "$FORGE_STATE_FILE"; if [ "$n" -eq 1 ]; then echo "connection reset" >&2; exit 1; fi; echo "estimated gas 123"'
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toContain("retrying once");
      expect(result.stdout).toContain("estimated gas 123");
      expect(readFileSync(fixture.castState, "utf8").trim()).toBe("2");
      expect(readFileSync(fixture.forgeState, "utf8").trim()).toBe("2");
    });
  });

  test("stops after three failed chain-ID reads without running Forge", () => {
    withRpcFixtures((fixture) => {
      const result = runWithRpcFixtures(
        fixture,
        'n=$(($(cat "$CAST_STATE_FILE" 2>/dev/null || echo 0) + 1)); echo "$n" > "$CAST_STATE_FILE"; exit 1',
        'echo should-not-run; exit 0'
      );
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("after 3 bounded attempts");
      expect(readFileSync(fixture.castState, "utf8").trim()).toBe("3");
      expect(() => readFileSync(fixture.forgeState, "utf8")).toThrow();
    });
  });
});
