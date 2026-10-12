import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertNoBroadcastArgs,
  collectDeploymentReport,
  renderAsciiBrand,
  removeRecordFlag,
  resolveBrand,
  scanBroadcastArtifacts,
  shouldUseColor,
} from "../scripts/deploy-console-core";

const GIWA_ADDRESS = "0x1111111111111111111111111111111111111111";
const GIWA_HASH = `0x${"a".repeat(64)}`;

function fakeClient(overrides = {}) {
  return {
    getChainId: async () => 91_342,
    getBlock: async () => ({ number: 123n }),
    getBalance: async () => 1_500_000_000_000_000_000n,
    getBytecode: async () => "0x6000",
    getTransactionReceipt: async () => ({
      status: "success",
      transactionHash: GIWA_HASH,
      blockNumber: 100n,
      contractAddress: GIWA_ADDRESS,
    }),
    ...overrides,
  };
}

const quietEnv = {
  DEPLOY_RPC_URL: "https://rpc.example.invalid",
  GIWA_ADMIN_ADDRESS: GIWA_ADDRESS,
  NEXT_PUBLIC_APP_NAME: "Protocol",
};

const tempRoots = [];

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "giwa-deploy-console-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("deployment terminal formatting", () => {
  test("uses configured brand precedence and strips terminal controls", () => {
    expect(resolveBrand({ DEPLOY_BRAND_NAME: "  GIWA\u001b[31m\nProtocol  ", NEXT_PUBLIC_APP_NAME: "Fallback" })).toBe("GIWA Protocol");
    expect(resolveBrand({ NEXT_PUBLIC_APP_NAME: "Existing Brand" })).toBe("Existing Brand");
    expect(resolveBrand({})).toBe("UNNAMED PROJECT");
  });

  test("keeps narrow terminal output readable", () => {
    const output = renderAsciiBrand("A long configurable brand", { columns: 14 });
    expect(output.split("\n").every((line) => line.length <= 14)).toBe(true);
    expect(output).toContain("> A long");
    const veryNarrow = renderAsciiBrand("Brand", { columns: 5 });
    expect(veryNarrow.split("\n").every((line) => line.length <= 5)).toBe(true);
  });

  test("respects NO_COLOR and non-TTY output", () => {
    expect(shouldUseColor({ isTTY: true, noColor: true })).toBe(false);
    expect(shouldUseColor({ isTTY: false, noColor: false })).toBe(false);
    expect(shouldUseColor({ isTTY: true, noColor: false })).toBe(true);
  });
});

describe("read-only deployment evidence", () => {
  test("reports missing RPC and signer without fabricating chain or receipt status", async () => {
    const report = await collectDeploymentReport({
      env: {},
      cwd: await temporaryRoot(),
      createClient: () => { throw new Error("must not create a client without an RPC"); },
      fetcher: fetch,
    });
    expect(report.rpcStatus).toBe("NOT CONFIGURED");
    expect(report.actualChainId).toBeUndefined();
    expect(report.signerStatus).toBe("NOT CONFIGURED");
    expect(report.confirmedDeployments).toEqual([]);
    expect(report.contracts.find((item) => item.name === "DemoCredentialRegistry")?.status).toBe("NOT CONFIGURED");
  });

  test("rejects a wrong chain and marks configured contracts blocked", async () => {
    const report = await collectDeploymentReport({
      env: { ...quietEnv, GIWA_CREDENTIAL_REGISTRY_ADDRESS: GIWA_ADDRESS },
      cwd: await temporaryRoot(),
      createClient: () => fakeClient({ getChainId: async () => 31_337 }),
      fetcher: fetch,
    });
    expect(report.rpcStatus).toBe("WRONG CHAIN");
    expect(report.actualChainId).toBe(31_337);
    expect(report.contracts.find((item) => item.name === "DemoCredentialRegistry")?.status).toBe("BLOCKED");
    expect(report.confirmedDeployments).toHaveLength(0);
  });

  test("reports missing signer while checking a valid GIWA RPC", async () => {
    const report = await collectDeploymentReport({
      env: { DEPLOY_RPC_URL: quietEnv.DEPLOY_RPC_URL },
      cwd: await temporaryRoot(),
      createClient: () => fakeClient(),
      fetcher: fetch,
    });
    expect(report.rpcStatus).toBe("AVAILABLE");
    expect(report.latestBlock).toBe(123n);
    expect(report.signerStatus).toBe("NOT CONFIGURED");
    expect(report.signerBalance).toBeUndefined();
  });

  test("reports RPC transport failure as unavailable", async () => {
    const report = await collectDeploymentReport({
      env: { DEPLOY_RPC_URL: quietEnv.DEPLOY_RPC_URL },
      cwd: await temporaryRoot(),
      createClient: () => fakeClient({ getChainId: async () => { throw new Error("offline"); } }),
      fetcher: fetch,
    });
    expect(report.rpcStatus).toBe("UNAVAILABLE");
    expect(report.actualChainId).toBeUndefined();
    expect(report.contracts.find((item) => item.name === "DojangScroll (official external)")?.status).toBe("ERROR");
  });

  test("does not treat local Anvil artifacts as GIWA deployment records", async () => {
    const root = await temporaryRoot();
    const directory = join(root, "contracts", "broadcast", "Deploy.s.sol", "31337");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "run-latest.json"), JSON.stringify({
      chain: 31337,
      transactions: [{
        transactionType: "CREATE",
        contractName: "DemoCredentialRegistry",
        contractAddress: GIWA_ADDRESS,
        hash: GIWA_HASH,
      }],
    }));
    const scan = await scanBroadcastArtifacts(root);
    expect(scan.localArtifactCount).toBe(1);
    expect(scan.giwaCandidateCount).toBe(0);
    expect(scan.deployments).toEqual([]);
  });

  test("counts a GIWA deployment only after successful RPC receipt and bytecode confirmation", async () => {
    const root = await temporaryRoot();
    const directory = join(root, "contracts", "broadcast", "Deploy.s.sol", "91342");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "run-latest.json"), JSON.stringify({
      chain: 91_342,
      transactions: [{
        transactionType: "CREATE",
        contractName: "DemoCredentialRegistry",
        contractAddress: GIWA_ADDRESS,
        hash: GIWA_HASH,
      }],
    }));
    const report = await collectDeploymentReport({
      env: { ...quietEnv, GIWA_CREDENTIAL_REGISTRY_ADDRESS: GIWA_ADDRESS },
      cwd: root,
      createClient: () => fakeClient(),
      fetcher: async () => new Response(JSON.stringify({ is_verified: true }), { status: 200 }),
    });
    const registry = report.contracts.find((item) => item.name === "DemoCredentialRegistry");
    expect(report.confirmedDeployments).toHaveLength(1);
    expect(registry?.status).toBe("SOURCE VERIFIED");
    expect(registry?.receipt?.blockNumber).toBe(100n);
    expect(registry?.explorerUrl).toContain(GIWA_ADDRESS);
  });

  test("does not infer source verification from bytecode presence or explorer response absence", async () => {
    const report = await collectDeploymentReport({
      env: { ...quietEnv, GIWA_CREDENTIAL_REGISTRY_ADDRESS: GIWA_ADDRESS },
      cwd: await temporaryRoot(),
      createClient: () => fakeClient(),
      fetcher: async () => new Response(JSON.stringify({ is_verified: false }), { status: 200 }),
    });
    const registry = report.contracts.find((item) => item.name === "DemoCredentialRegistry");
    expect(registry?.status).toBe("CODE PRESENT");
    expect(registry?.verification).toBe("NOT VERIFIED");
  });

  test("does not confirm failed receipts or absent bytecode", async () => {
    const root = await temporaryRoot();
    const directory = join(root, "contracts", "broadcast", "Deploy.s.sol", "91342");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "run-latest.json"), JSON.stringify({
      chain: 91_342,
      transactions: [{
        transactionType: "CREATE",
        contractName: "DemoCredentialRegistry",
        contractAddress: GIWA_ADDRESS,
        hash: GIWA_HASH,
      }],
    }));
    const report = await collectDeploymentReport({
      env: { ...quietEnv, GIWA_CREDENTIAL_REGISTRY_ADDRESS: GIWA_ADDRESS },
      cwd: root,
      createClient: () => fakeClient({
        getTransactionReceipt: async () => ({ status: "reverted", transactionHash: GIWA_HASH, blockNumber: 100n, contractAddress: GIWA_ADDRESS }),
        getBytecode: async () => undefined,
      }),
      fetcher: fetch,
    });
    expect(report.confirmedDeployments).toEqual([]);
    expect(report.contracts.find((item) => item.name === "DemoCredentialRegistry")?.status).toBe("NOT DEPLOYED");
  });

  test("record presentation leaves simulation arguments unchanged and rejects broadcast flags", () => {
    for (const flag of ["--broadcast", "--broadcast=true", "--account", "--private-key", "--sender", "--unlocked"]) {
      expect(() => assertNoBroadcastArgs(["script:Deploy", flag])).toThrow();
    }
    let rejectedOption = "";
    try {
      assertNoBroadcastArgs(["script:Deploy", "--private-key=do-not-print-this"]);
    } catch (error) {
      rejectedOption = error.message;
    }
    expect(rejectedOption).toContain("--private-key");
    expect(rejectedOption).not.toContain("do-not-print-this");
    const parsed = removeRecordFlag(["--record", "script:Deploy", "--rpc-url", "https://rpc.example.invalid"]);
    expect(parsed.record).toBe(true);
    expect(parsed.args).toEqual(["script:Deploy", "--rpc-url", "https://rpc.example.invalid"]);
    expect(() => assertNoBroadcastArgs(parsed.args)).not.toThrow();
  });
});
