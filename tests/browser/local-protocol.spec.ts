import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AddressInfo } from "node:net";
import { test } from "@playwright/test";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { computeEligibilityCommitment } from "../../src/lib/zk/commitment";
import { credentialRegistryAbi } from "../../src/lib/contracts/abis";
import type { BrowserFlowResult } from "./protocol-harness";

test.setTimeout(240_000);

const chain = defineChain({
  id: 91_342,
  name: "GIWA Sepolia local protocol test",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
});
const repoRoot = process.cwd();

function loadArtifact(name: string) {
  return JSON.parse(readFileSync(path.join(repoRoot, "contracts/out", name), "utf8")) as {
    abi: readonly unknown[];
    bytecode: {
      object: string;
      linkReferences?: Record<string, Record<string, { start: number; length: number }[]>>;
    };
  };
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
    const accountsResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_accounts", params: [] }),
    });
    const accountsBody = await accountsResponse.json() as { result: Address[] };
    const accounts = accountsBody.result;
    assert.ok(accounts.length >= 3, "Anvil should provide unlocked local test accounts");
    const [admin, issuer, subject, attacker, outsider] = accounts;
    const adminWallet = createWalletClient({ account: admin, chain, transport: http(rpcUrl) });
    const issuerWallet = createWalletClient({ account: issuer, chain, transport: http(rpcUrl) });
    const libraryAddresses = new Map<string, Address>();
    const deploy = async (artifactPath: string, args: readonly unknown[] = [], client = adminWallet) => {
      const artifact = loadArtifact(artifactPath);
      const bytecode = await linkBytecode(artifact);
      const hash = await client.deployContract({
        abi: artifact.abi as never,
        bytecode,
        args: args as never,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", `${artifactPath} deployment failed`);
      assert.ok(receipt.contractAddress, `${artifactPath} did not return a deployment address`);
      return receipt.contractAddress;
    };
    const linkBytecode = async (artifact: ReturnType<typeof loadArtifact>) => {
      let object = artifact.bytecode.object.replace(/^0x/, "");
      const libraryReferences = Object.entries(artifact.bytecode.linkReferences ?? {})
        .flatMap(([source, libraries]) => Object.entries(libraries)
          .flatMap(([libraryName, references]) => references.map((reference) => ({ source, libraryName, reference }))))
        .sort((left, right) => left.reference.start - right.reference.start);
      const placeholders = [...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)];
      assert.equal(placeholders.length, libraryReferences.length, "Library placeholders do not match Solidity link references");
      const resolved: { index: number; placeholder: string; address: Address }[] = [];

      for (const [index, entry] of libraryReferences.entries()) {
        const libraryArtifactPath = `${path.basename(entry.source)}/${entry.libraryName}.json`;
        let libraryAddress = libraryAddresses.get(libraryArtifactPath);
        if (!libraryAddress) {
          libraryAddress = await deploy(libraryArtifactPath);
          libraryAddresses.set(libraryArtifactPath, libraryAddress);
        }
        resolved.push({
          index: placeholders[index].index!,
          placeholder: placeholders[index][0],
          address: libraryAddress,
        });
      }

      for (const link of resolved.sort((left, right) => right.index - left.index)) {
        object = `${object.slice(0, link.index)}${link.address.slice(2).toLowerCase()}${object.slice(link.index + link.placeholder.length)}`;
      }
      assert.equal(
        [...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)].length,
        0,
        "Contract bytecode still contains unresolved library placeholders",
      );
      return `0x${object}` as `0x${string}`;
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
    const salt = `0x${"00".repeat(31)}39` as Hex;
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

    const attackerCommitment = await computeEligibilityCommitment({
      subject: attacker,
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
    const attackerIssueHash = await issuerWallet.writeContract({
      address: registry,
      abi: credentialRegistryAbi,
      functionName: "recordCredential",
      args: [attacker, 1n, attackerCommitment, expiresAt, 1n],
    });
    await publicClient.waitForTransactionReceipt({ hash: attackerIssueHash });

    const unauthorizedIssue = await publicClient.simulateContract({
      account: attacker,
      address: registry,
      abi: credentialRegistryAbi,
      functionName: "recordCredential",
      args: [attacker, 1n, commitment, expiresAt, 1n],
    }).then(() => false, () => true);
    assert.equal(unauthorizedIssue, true, "a non-issuer unexpectedly passed issuance authorization");

    const artifactsDir = await mkdtemp(path.join(os.tmpdir(), "giwa-browser-e2e-"));
    const bundlePath = path.join(artifactsDir, "protocol-harness.js");
    const workerBundlePath = path.join(artifactsDir, "main.worker.js");
    execFileSync("bun", [
      "build", path.join(repoRoot, "tests/browser/protocol-harness.ts"),
      "--target", "browser", "--format", "esm", "--outfile", bundlePath,
    ], { cwd: repoRoot, stdio: "pipe" });
    execFileSync("bun", [
      "build", path.join(repoRoot, "node_modules/@aztec/bb.js/dest/browser/barretenberg_wasm/barretenberg_wasm_main/factory/browser/main.worker.js"),
      "--target", "browser", "--format", "esm", "--outfile", workerBundlePath,
    ], { cwd: repoRoot, stdio: "pipe" });
    const [bundle, workerBundle, noirAbiWasm, acvmWasm] = await Promise.all([
      readFile(bundlePath),
      readFile(workerBundlePath),
      readFile(path.join(repoRoot, "node_modules/@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm")),
      readFile(path.join(repoRoot, "node_modules/@noir-lang/acvm_js/web/acvm_js_bg.wasm")),
    ]);
    const circuitArtifact = await readFile(path.join(repoRoot, "public/circuits/private_eligibility.json"));
    server = createServer((request, response) => {
      if (request.url === "/protocol-harness.js") {
        response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
        response.end(bundle);
      } else if (request.url === "/main.worker.js") {
        response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
        response.end(workerBundle);
      } else if (request.url === "/circuits/private_eligibility.json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(circuitArtifact);
      } else if (request.url === "/noirc_abi_wasm_bg.wasm") {
        response.writeHead(200, { "content-type": "application/wasm" });
        response.end(noirAbiWasm);
      } else if (request.url === "/acvm_js_bg.wasm") {
        response.writeHead(200, { "content-type": "application/wasm" });
        response.end(acvmWasm);
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

    const browserErrors: string[] = [];
    const browserNetwork: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      browserErrors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    });
    page.on("request", (request) => {
      browserNetwork.push(`request ${request.url()}`);
    });
    page.on("response", (response) => {
      const headers = response.headers();
      browserNetwork.push(`response ${response.status()} ${headers["content-type"] ?? ""} ${response.url()}`);
    });
    await page.goto(`http://127.0.0.1:${testPagePort}`);
    await page.waitForFunction(() => (window as Window & { proverHarnessReady?: boolean }).proverHarnessReady === true);
    const browserInput = {
      rpcUrl,
      vault,
      attacker,
      outsider,
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
    };
    const progressTimer = setInterval(() => {
      void page.evaluate(() => (window as Window & { giwaTestProgress?: string }).giwaTestProgress)
        .then((progress) => console.log(`BROWSER_PROGRESS ${progress ?? "initializing"}`))
        .catch(() => undefined);
    }, 20_000);
    let browserResult: BrowserFlowResult;
    try {
      browserResult = await page.evaluate(async (input) => {
        const target = window as unknown as Window & {
          runBrowserLocalFlow: (value: typeof input) => Promise<BrowserFlowResult>;
        };
        return target.runBrowserLocalFlow(input);
      }, browserInput);
    } catch (error) {
      console.log("BROWSER_DIAGNOSTICS " + JSON.stringify(browserErrors));
      console.log("BROWSER_NETWORK " + JSON.stringify(browserNetwork));
      throw error;
    } finally {
      clearInterval(progressTimer);
    }
    assert.equal(browserResult.localVerification, "verified");
    assert.equal(browserResult.publicInputCount, 9);
    assert.equal(browserResult.underThresholdRejected, true);
    assert.equal(browserResult.transactionStatus, "success");
    assert.equal(browserResult.hasAccess, true);

    assert.equal(browserResult.invalidProofRejected, true);
    assert.equal(browserResult.wrongWalletRejected, true);
    assert.equal(browserResult.missingCredentialRejected, true);
    assert.equal(browserResult.replayRejected, true);

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
      invalidProofRejected: browserResult.invalidProofRejected,
      wrongWalletRejected: browserResult.wrongWalletRejected,
      missingCredentialRejected: browserResult.missingCredentialRejected,
      transactionHash: browserResult.transactionHash,
      transactionStatus: browserResult.transactionStatus,
      blockNumber: browserResult.blockNumber,
      hasAccess: browserResult.hasAccess,
      replayRejected: browserResult.replayRejected,
      privateValuePublished: false,
      result: "browser-generated proof accepted by generated Solidity verifier and local RestrictedVault",
    }));
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    anvil.kill("SIGTERM");
  }
});
