import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { AddressInfo } from "node:net";
import { test } from "@playwright/test";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
} from "viem";
import { computeEligibilityCommitment } from "../../src/lib/zk/commitment";
import { restrictedVaultAbi, credentialRegistryAbi } from "../../src/lib/contracts/abis";

test.setTimeout(240_000);

const chain = defineChain({
  id: 91_342,
  name: "GIWA Sepolia local protocol test",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
});
const repoRoot = path.resolve(import.meta.dirname, "../..");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function loadArtifact(name: string) {
  return JSON.parse(
    require("node:fs").readFileSync(path.join(repoRoot, "contracts/out", name), "utf8"),
  ) as { abi: readonly unknown[]; bytecode: { object: string } };
}

async function waitForRpc(rpcUrl: string, process: ChildProcess) {
  const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 2_000 }) });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (process.exitCode !== null) throw new Error(`Anvil exited with status ${process.exitCode}.`);
    try {
      if (await client.getChainId() === 91_342) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Anvil did not become ready on the local RPC port.");
}

test("browser-generated proof grants access through the real local vault", async ({ page }) => {
  const portProbe = createServer();
  await new Promise<void>((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
  const anvilPort = (portProbe.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
  const rpcUrl = `http://127.0.0.1:${anvilPort}`;
  const anvil = spawn("anvil", [
    "--silent", "--host", "127.0.0.1", "--port", String(anvilPort),
    "--chain-id", "91342", "--accounts", "5", "--gas-limit", "100000000",
    "--disable-code-size-limit",
  ], { stdio: "ignore" });

  let server: Server | undefined;
  try {
    await waitForRpc(rpcUrl, anvil);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const accounts = await publicClient.request({ method: "eth_accounts" }) as Address[];
    assert.ok(accounts.length >= 3, "Anvil should provide unlocked local test accounts");
    const [admin, issuer, subject, attacker] = accounts;
    const adminWallet = createWalletClient({ account: admin, chain, transport: http(rpcUrl) });
    const issuerWallet = createWalletClient({ account: issuer, chain, transport: http(rpcUrl) });
    const deploy = async (artifactPath: string, args: readonly unknown[] = [], client = adminWallet) => {
      const artifact = loadArtifact(artifactPath);
      const hash = await client.deployContract({
        abi: artifact.abi as never,
        bytecode: `0x${artifact.bytecode.object.replace(/^0x/, "")}`,
        args: args as never,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", `${artifactPath} deployment failed`);
      assert.ok(receipt.contractAddress, `${artifactPath} did not return a deployment address`);
      return receipt.contractAddress;
    };

    const registry = await deploy("DemoCredentialRegistry.sol/DemoCredentialRegistry.json");
    const honkVerifier = await deploy("EligibilityHonkVerifier.sol/HonkVerifier.json");
    const adapter = await deploy("EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json", [honkVerifier]);
    const vault = await deploy("RestrictedVault.sol/RestrictedVault.json", [registry, adapter]);
    const accessAbi = parseAbi([
      "function ISSUER_ROLE() view returns (bytes32)",
      "function grantRole(bytes32 role, address account)",
    ]);
    const issuerRole = await publicClient.readContract({
      address: registry,
      abi: accessAbi,
      functionName: "ISSUER_ROLE",
    });
    const grantHash = await adminWallet.writeContract({
      address: registry,
      abi: accessAbi,
      functionName: "grantRole",
      args: [issuerRole, issuer],
    });
    await publicClient.waitForTransactionReceipt({ hash: grantHash });

    const latestBlock = await publicClient.getBlock();
    const expiresAt = latestBlock.timestamp + 3_600n;
    const privateValue = "1250";
    const salt = `0x${"00".repeat(31)}39` as const;
    const commitment = await computeEligibilityCommitment({
      subject,
      privateValue,
      salt,
      policyId: 1n,
      policyVersion: 1n,
      threshold: 1_000n,
      credentialVersion: 1n,
      expiresAt,
      chainId: 91_342n,
      vault,
    });
    const issueHash = await issuerWallet.writeContract({
      address: registry,
      abi: credentialRegistryAbi,
      functionName: "recordCredential",
      args: [subject, 1n, commitment, expiresAt, 1n],
    });
    const issueReceipt = await publicClient.waitForTransactionReceipt({ hash: issueHash });
    assert.equal(issueReceipt.status, "success", "local demo credential issuance failed");
    const credential = await publicClient.readContract({
      address: registry,
      abi: credentialRegistryAbi,
      functionName: "getCredential",
      args: [subject, 1n],
    });
    assert.equal(credential.issuer.toLowerCase(), issuer.toLowerCase());
    assert.equal(credential.commitment.toLowerCase(), commitment.toLowerCase());
    assert.equal(credential.revoked, false);

    const unauthorizedIssue = await publicClient.simulateContract({
      account: attacker,
      address: registry,
      abi: credentialRegistryAbi,
      functionName: "recordCredential",
      args: [attacker, 1n, commitment, expiresAt, 1n],
    }).then(() => false, () => true);
    assert.equal(unauthorizedIssue, true, "a non-issuer unexpectedly passed issuance authorization");

    const artifactsDir = await import("node:fs/promises").then(({ mkdtemp }) =>
      mkdtemp(path.join(os.tmpdir(), "giwa-browser-e2e-")),
    );
    const bundlePath = path.join(artifactsDir, "protocol-harness.js");
    execFileSync("bun", [
      "build", path.join(repoRoot, "tests/browser/protocol-harness.ts"),
      "--target", "browser", "--format", "esm", "--outfile", bundlePath,
    ], { cwd: repoRoot, stdio: "pipe" });
    const bundle = await readFile(bundlePath);
    const circuitArtifact = await readFile(path.join(repoRoot, "public/circuits/private_eligibility.json"));
    server = createServer((request, response) => {
      if (request.url === "/protocol-harness.js") {
        response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
        response.end(bundle);
      } else if (request.url === "/circuits/private_eligibility.json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(circuitArtifact);
      } else {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(`<!doctype html><meta charset="utf-8"><title>Local prover test</title>
          <script type="module">
            import { runBrowserLocalFlow } from "/protocol-harness.js";
            window.runBrowserLocalFlow = runBrowserLocalFlow;
            window.proverHarnessReady = true;
          </script>`);
      }
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const testPagePort = (server.address() as AddressInfo).port;

    await page.goto(`http://127.0.0.1:${testPagePort}`);
    await page.waitForFunction(() => (window as Window & { proverHarnessReady?: boolean }).proverHarnessReady === true);
    const browserResult = await page.evaluate(async (input) => {
      const target = window as Window & {
        runBrowserLocalFlow: (value: typeof input) => Promise<unknown>;
      };
      return target.runBrowserLocalFlow(input);
    }, {
      rpcUrl,
      vault,
      witness: {
        format: "giwa-demo-credential-v1" as const,
        wallet: subject,
        policyId: 1,
        commitment,
        privateValue,
        salt,
        expiresAt: Number(expiresAt),
      },
      context: {
        subject,
        commitment,
        policyId: "1",
        policyVersion: "1",
        threshold: "1000",
        credentialVersion: "1",
        expiresAt: expiresAt.toString(),
        chainId: "91342",
        vault,
      },
    });
    assert.equal(browserResult.localVerification, "verified");
    assert.equal(browserResult.publicInputCount, 9);
    assert.equal(browserResult.underThresholdRejected, true);
    assert.equal(browserResult.transactionStatus, "success");
    assert.equal(browserResult.hasAccess, true);

    const badProof = `0x${"00".repeat(browserResult.proofBytes)}` as const;
    const badProofRejected = await publicClient.simulateContract({
      account: subject,
      address: vault,
      abi: restrictedVaultAbi,
      functionName: "enterVault",
      args: [badProof, [
        BigInt(subject), BigInt(commitment), 1n, 1n, 1_000n, 1n,
        expiresAt, 91_342n, BigInt(vault),
      ]],
    }).then(() => false, () => true);
    assert.equal(badProofRejected, true, "the local vault unexpectedly accepted invalid proof bytes");

    const wrongWalletRejected = await publicClient.simulateContract({
      account: attacker,
      address: vault,
      abi: restrictedVaultAbi,
      functionName: "enterVault",
      args: ["0x", [
        BigInt(subject), BigInt(commitment), 1n, 1n, 1_000n, 1n,
        expiresAt, 91_342n, BigInt(vault),
      ]],
    }).then(() => false, () => true);
    assert.equal(wrongWalletRejected, true, "the local vault unexpectedly accepted a proof for another wallet");

    const replayRejected = await publicClient.simulateContract({
      account: subject,
      address: vault,
      abi: restrictedVaultAbi,
      functionName: "enterVault",
      args: ["0x", [
        BigInt(subject), BigInt(commitment), 1n, 1n, 1_000n, 1n,
        expiresAt, 91_342n, BigInt(vault),
      ]],
    }).then(() => false, () => true);
    assert.equal(replayRejected, true, "the local vault unexpectedly accepted replay after access was granted");

    console.log("LOCAL_PROTOCOL_E2E " + JSON.stringify({
      chainId: 91_342,
      registry,
      verifier: adapter,
      vault,
      subject,
      issuer,
      credentialVersion: credential.version.toString(),
      commitment,
      proofBytes: browserResult.proofBytes,
      proofElapsedMs: browserResult.proofElapsedMs,
      publicInputCount: browserResult.publicInputCount,
      localVerification: browserResult.localVerification,
      underThresholdRejected: browserResult.underThresholdRejected,
      unauthorizedIssuerRejected: unauthorizedIssue,
      invalidProofRejected: badProofRejected,
      wrongWalletRejected,
      transactionHash: browserResult.transactionHash,
      transactionStatus: browserResult.transactionStatus,
      blockNumber: browserResult.blockNumber,
      hasAccess: browserResult.hasAccess,
      replayRejected,
      privateValuePublished: false,
      result: "browser-generated proof accepted by generated Solidity verifier and local RestrictedVault",
    }));
    void keccak256(stringToHex("test helper import guard"));
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    anvil.kill("SIGTERM");
  }
});

// Keep these imports checked at compile time without using or exposing local private keys.
assert.ok(existsSync(chromePath) || process.platform !== "darwin", "Chrome path is missing on macOS");
