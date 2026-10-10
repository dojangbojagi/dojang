import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from "viem";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsRoot = path.resolve(root, "contracts/out");
const chainId = 91_342;
const chain = defineChain({
  id: chainId,
  name: "GIWA Sepolia local deployment estimate",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
});

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function artifact(relativePath) {
  return JSON.parse(await readFile(path.join(artifactsRoot, relativePath), "utf8"));
}

async function main() {
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", [
    "--silent", "--host", "127.0.0.1", "--port", String(port),
    "--chain-id", String(chainId), "--accounts", "2", "--gas-limit", "60000000",
  ], { stdio: "ignore" });

  try {
    const publicClient = createPublicClient({
      chain: { ...chain, rpcUrls: { default: { http: [rpcUrl] } } },
      transport: http(rpcUrl),
    });
    for (let attempt = 0; attempt < 80; attempt++) {
      if (anvil.exitCode !== null) throw new Error(`Anvil exited with status ${anvil.exitCode}.`);
      try {
        if (await publicClient.getChainId() === chainId) break;
      } catch {}
      if (attempt === 79) throw new Error("Local Anvil did not become ready.");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_accounts", params: [] }),
    });
    const { result: accounts } = await response.json();
    assert.ok(accounts.length >= 2, "Anvil should expose its local development accounts.");
    const [admin, issuer] = accounts;
    const wallet = createWalletClient({
      account: admin,
      chain: { ...chain, rpcUrls: { default: { http: [rpcUrl] } } },
      transport: http(rpcUrl),
    });
    const libraryAddresses = new Map();
    const deployments = [];

    async function deploy(relativePath, args = []) {
      const compiled = await artifact(relativePath);
      const bytecode = await linkBytecode(compiled);
      const hash = await wallet.deployContract({ abi: compiled.abi, bytecode, args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", `${relativePath} local deployment failed.`);
      assert.ok(receipt.contractAddress, `${relativePath} did not produce a contract address.`);
      deployments.push({ contract: relativePath, address: receipt.contractAddress, gasUsed: receipt.gasUsed.toString() });
      return receipt.contractAddress;
    }

    async function linkBytecode(compiled) {
      let object = compiled.bytecode.object.replace(/^0x/, "");
      const refs = Object.entries(compiled.bytecode.linkReferences ?? [])
        .flatMap(([source, libraries]) => Object.entries(libraries)
          .flatMap(([libraryName, references]) => references.map((reference) => ({ source, libraryName, reference }))))
        .sort((left, right) => left.reference.start - right.reference.start);
      const placeholders = [...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)];
      assert.equal(placeholders.length, refs.length, "Artifact library placeholders do not match link references.");
      const resolved = [];

      for (const [index, entry] of refs.entries()) {
        const key = `${path.basename(entry.source)}/${entry.libraryName}.json`;
        let address = libraryAddresses.get(key);
        if (!address) {
          address = await deploy(key);
          libraryAddresses.set(key, address);
        }
        resolved.push({ index: placeholders[index].index, placeholder: placeholders[index][0], address });
      }

      for (const link of resolved.sort((left, right) => right.index - left.index)) {
        object = `${object.slice(0, link.index)}${link.address.slice(2).toLowerCase()}${object.slice(link.index + link.placeholder.length)}`;
      }
      assert.equal([...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)].length, 0, "Unresolved library link remains.");
      return `0x${object}`;
    }

    const transcriptLibrary = await deploy("EligibilityHonkVerifier.sol/ZKTranscriptLib.json");
    libraryAddresses.set("EligibilityHonkVerifier.sol/ZKTranscriptLib.json", transcriptLibrary);
    const relationsLibrary = await deploy("EligibilityHonkVerifier.sol/RelationsLib.json");
    libraryAddresses.set("EligibilityHonkVerifier.sol/RelationsLib.json", relationsLibrary);
    const generatedVerifier = await deploy("EligibilityHonkVerifier.sol/HonkVerifier.json");
    const registry = await deploy("DemoCredentialRegistry.sol/DemoCredentialRegistry.json");
    const adapter = await deploy("EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json", [generatedVerifier]);
    const vault = await deploy("RestrictedVault.sol/RestrictedVault.json", [registry, adapter]);
    const lendingAsset = await deploy("ControlledTestToken.sol/ControlledTestToken.json", [
      "GIWA Demo Lending Dollar", "gUSD", 6, 10n ** 15n, admin,
    ]);
    const collateralAsset = await deploy("ControlledTestToken.sol/ControlledTestToken.json", [
      "GIWA Demo Collateral", "gCOL", 18, 10n ** 27n, admin,
    ]);
    const lendingPool = await deploy("LendingPool.sol/LendingPool.json", [registry, adapter, lendingAsset, collateralAsset]);

    const roleAbi = parseAbi([
      "function ISSUER_ROLE() view returns (bytes32)",
      "function grantRole(bytes32 role, address account)",
    ]);
    const issuerRole = await publicClient.readContract({ address: registry, abi: roleAbi, functionName: "ISSUER_ROLE" });
    const { request } = await publicClient.simulateContract({
      account: admin,
      address: registry,
      abi: roleAbi,
      functionName: "grantRole",
      args: [issuerRole, issuer],
    });
    const grantHash = await wallet.writeContract(request);
    const grantReceipt = await publicClient.waitForTransactionReceipt({ hash: grantHash });
    assert.equal(grantReceipt.status, "success", "Local issuer role grant failed.");
    deployments.push({ contract: "DemoCredentialRegistry.grantRole(ISSUER_ROLE)", gasUsed: grantReceipt.gasUsed.toString() });

    const totalGasUsed = deployments.reduce((sum, entry) => sum + BigInt(entry.gasUsed), 0n);
    process.stdout.write(JSON.stringify({
      estimateType: "local Anvil execution gas only; not a GIWA RPC fee quote",
      chainId,
      deploymentTransactions: deployments.length,
      totalExecutionGasUsed: totalGasUsed.toString(),
      deployments,
      externalNetworkTransactions: false,
    }, null, 2) + "\n");
  } finally {
    anvil.kill("SIGTERM");
  }
}

await main();
