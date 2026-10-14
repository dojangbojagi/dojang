import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  toHex,
} from "viem";
import { computeEligibilityCommitment, generateFieldSalt } from "../../src/lib/zk/commitment.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactsRoot = path.resolve(root, "contracts/out-mainnet");
const crsPath = path.resolve(root, "circuits/cache/bb-crs");
const chainId = 4_663;
const chain = defineChain({
  id: chainId,
  name: "Robinhood Mainnet demo isolated local Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
});
const RAY_INPUTS = 9;
const loanUnit = 10n ** 6n;
const collateralUnit = 10n ** 18n;
const policyId = 3n;
const policyVersion = 1n;
const threshold = 1_000n;

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

async function waitReceipt(client, hash) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", `Transaction ${hash} failed.`);
  return receipt;
}

async function main() {
  await mkdir(crsPath, { recursive: true });
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", [
    "--silent", "--host", "127.0.0.1", "--port", String(port), "--chain-id", String(chainId),
    "--accounts", "12", "--gas-limit", "100000000",
  ], { stdio: "ignore" });
  let bb;

  try {
    const localChain = { ...chain, rpcUrls: { default: { http: [rpcUrl] } } };
    const publicClient = createPublicClient({ chain: localChain, transport: http(rpcUrl) });
    for (let attempt = 0; attempt < 80; attempt++) {
      if (anvil.exitCode !== null) throw new Error(`Anvil exited with status ${anvil.exitCode}.`);
      try {
        if (await publicClient.getChainId() === chainId) break;
      } catch {}
      if (attempt === 79) throw new Error("Local Anvil did not become ready on explicit chain 4663.");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const accounts = await publicClient.request({ method: "eth_accounts" });
    assert.ok(accounts.length >= 10, "Local Mainnet simulation needs ten unlocked local test accounts.");
    const [deployer, admin, issuer, oracleUpdater, riskAdmin, pauseAuthority, minter, supplier, borrower] = accounts;
    const wallet = (account) => createWalletClient({ account, chain: localChain, transport: http(rpcUrl) });
    const deployerWallet = wallet(deployer);
    const adminWallet = wallet(admin);
    const issuerWallet = wallet(issuer);
    const oracleWallet = wallet(oracleUpdater);
    const pauseWallet = wallet(pauseAuthority);
    const minterWallet = wallet(minter);
    const supplierWallet = wallet(supplier);
    const borrowerWallet = wallet(borrower);
    const linkedLibraries = new Map();

    async function deploy(relativePath, args = [], signingWallet = deployerWallet) {
      const contractArtifact = await artifact(relativePath);
      const bytecode = await linkBytecode(contractArtifact);
      const hash = await signingWallet.deployContract({ abi: contractArtifact.abi, bytecode, args, gas: 90_000_000n });
      const receipt = await waitReceipt(publicClient, hash);
      assert.ok(receipt.contractAddress, `${relativePath} deployment returned no address.`);
      return receipt.contractAddress;
    }

    async function linkBytecode(contractArtifact) {
      let object = contractArtifact.bytecode.object.replace(/^0x/, "");
      const references = Object.entries(contractArtifact.bytecode.linkReferences ?? [])
        .flatMap(([source, libraries]) => Object.entries(libraries)
          .flatMap(([libraryName, locations]) => locations.map((location) => ({ source, libraryName, location }))))
        .sort((a, b) => a.location.start - b.location.start);
      const placeholders = [...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)];
      assert.equal(placeholders.length, references.length, "Verifier library link references mismatch.");
      const replacements = [];
      for (const [index, reference] of references.entries()) {
        const libraryPath = `${path.basename(reference.source)}/${reference.libraryName}.json`;
        let address = linkedLibraries.get(libraryPath);
        if (!address) {
          address = await deploy(libraryPath);
          linkedLibraries.set(libraryPath, address);
        }
        replacements.push({ at: placeholders[index].index, placeholder: placeholders[index][0], address });
      }
      for (const item of replacements.sort((a, b) => b.at - a.at)) {
        object = `${object.slice(0, item.at)}${item.address.slice(2).toLowerCase()}${object.slice(item.at + item.placeholder.length)}`;
      }
      assert.equal([...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)].length, 0, "Verifier library link unresolved.");
      return `0x${object}`;
    }

    const registryArtifactPath = "RobinhoodMainnetDemoCredentialRegistry.sol/RobinhoodMainnetDemoCredentialRegistry.json";
    const tokenArtifactPath = "RobinhoodMainnetDemoToken.sol/RobinhoodMainnetDemoToken.json";
    const oracleArtifactPath = "RobinhoodMainnetDemoOracle.sol/RobinhoodMainnetDemoOracle.json";
    const poolArtifactPath = "RobinhoodMainnetDemoLendingPool.sol/RobinhoodMainnetDemoLendingPool.json";
    const registryArtifact = await artifact(registryArtifactPath);
    const tokenArtifact = await artifact(tokenArtifactPath);
    const oracleArtifact = await artifact(oracleArtifactPath);
    const poolArtifact = await artifact(poolArtifactPath);
    const verifierArtifact = await artifact("EligibilityHonkVerifier.sol/HonkVerifier.json");
    const adapterArtifact = await artifact("EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json");

    const registry = await deploy(registryArtifactPath, [admin, issuer]);
    const generatedVerifier = await deploy("EligibilityHonkVerifier.sol/HonkVerifier.json");
    const verifierAdapter = await deploy("EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json", [generatedVerifier]);
    const loanToken = await deploy(tokenArtifactPath, ["Local Mainnet DEMO Lending", "dUSD", 6, 1_000_000n * loanUnit, admin, minter]);
    const collateralToken = await deploy(tokenArtifactPath, ["Local Mainnet DEMO Collateral", "dCOL", 18, 1_000_000n * collateralUnit, admin, minter]);
    const oracle = await deploy(oracleArtifactPath, [
      admin, oracleUpdater, loanToken, 950_000_000_000_000_000n, 1_050_000_000_000_000_000n,
      collateralToken, 500_000_000_000_000_000n, 4_000_000_000_000_000_000n,
    ]);

    const loanConfig = {
      supplyCap: 100_000n * loanUnit, borrowCap: 50_000n * loanUnit, collateralCap: 0n,
      minBorrowAmount: loanUnit, maxOracleAge: 3_600, maxLtvBps: 5_000,
      liquidationThresholdBps: 6_500, liquidationBonusBps: 500, closeFactorBps: 5_000,
      reserveFactorBps: 1_000, optimalUtilizationBps: 8_000, baseBorrowRateBps: 200,
      slope1Bps: 400, slope2Bps: 6_000, active: true, supplyEnabled: true,
      borrowEnabled: true, collateralEnabled: false,
    };
    const collateralConfig = {
      ...loanConfig, supplyCap: 0n, borrowCap: 0n, collateralCap: 100_000n * collateralUnit,
      minBorrowAmount: 0n, supplyEnabled: false, borrowEnabled: false, collateralEnabled: true,
    };
    const pool = await deploy(poolArtifactPath, [
      registry, verifierAdapter, oracle, admin, riskAdmin, pauseAuthority,
      loanToken, collateralToken, [supplier, borrower], loanConfig, collateralConfig,
    ]);
    assert.equal(await publicClient.readContract({ address: pool, abi: poolArtifact.abi, functionName: "paused" }), true);
    assert.equal((await publicClient.readContract({ address: pool, abi: poolArtifact.abi, functionName: "demoLoanAsset" })).toLowerCase(), loanToken.toLowerCase());
    assert.equal((await publicClient.readContract({ address: pool, abi: poolArtifact.abi, functionName: "demoCollateralAsset" })).toLowerCase(), collateralToken.toLowerCase());

    const oracleAbi = oracleArtifact.abi;
    const oraclePrice1 = 1_000_000_000_000_000_000n;
    const oraclePrice2 = 2_000_000_000_000_000_000n;
    await writeAndWait(oracleWallet, oracle, oracleAbi, "setPrice", [loanToken, oraclePrice1]);
    await writeAndWait(oracleWallet, oracle, oracleAbi, "setPrice", [collateralToken, oraclePrice2]);
    await writeAndWait(pauseWallet, pool, poolArtifact.abi, "unpauseRisk", []);
    await writeAndWait(minterWallet, loanToken, tokenArtifact.abi, "mint", [supplier, 10_000n * loanUnit]);
    await writeAndWait(minterWallet, loanToken, tokenArtifact.abi, "mint", [borrower, 1_000n * loanUnit]);
    await writeAndWait(minterWallet, collateralToken, tokenArtifact.abi, "mint", [borrower, 1_000n * collateralUnit]);

    const circuit = JSON.parse(await readFile(path.join(root, "public/circuits/private_eligibility.json"), "utf8"));
    bb = await Barretenberg.new({ threads: 1, crsPath });
    const noir = new Noir(circuit);
    const backend = new UltraHonkBackend(circuit.bytecode, bb);

    async function proveAndIssue(subject, privateValue) {
      const salt = generateFieldSalt();
      const block = await publicClient.getBlock();
      const expiresAt = block.timestamp + 10n * 24n * 60n * 60n;
      const previous = await publicClient.readContract({
        address: registry, abi: registryArtifact.abi, functionName: "getCredential", args: [subject, policyId],
      });
      const version = previous.wallet === "0x0000000000000000000000000000000000000000" ? 1n : previous.version + 1n;
      const commitment = await computeEligibilityCommitment({
        subject, privateValue, salt, policyId, policyVersion, threshold,
        credentialVersion: version, expiresAt, chainId: BigInt(chainId), vault: pool,
      });
      await writeAndWait(issuerWallet, registry, registryArtifact.abi, "recordCredential", [subject, policyId, commitment, expiresAt, version]);
      const context = {
        subject: BigInt(subject).toString(), commitment: BigInt(commitment).toString(),
        policy_id: policyId.toString(), policy_version: policyVersion.toString(), threshold: threshold.toString(),
        credential_version: version.toString(), expires_at: expiresAt.toString(), chain_id: String(chainId),
        vault_address: BigInt(pool).toString(),
      };
      const { witness } = await noir.execute({ ...context, private_value: privateValue, salt: BigInt(salt).toString() });
      const generated = await backend.generateProof(witness, { verifierTarget: "evm" });
      assert.equal(await backend.verifyProof(generated, { verifierTarget: "evm" }), true, "Barretenberg proof verification failed.");
      assert.equal(generated.publicInputs.length, RAY_INPUTS);
      const publicInputs = generated.publicInputs.map(BigInt);
      assert.equal(publicInputs[7], BigInt(chainId), "proof is not bound to Mainnet chain 4663");
      assert.equal(publicInputs[8], BigInt(pool), "proof is not bound to this pool address");
      const adapterValid = await publicClient.readContract({
        address: verifierAdapter, abi: adapterArtifact.abi, functionName: "verifyProof",
        args: [toHex(generated.proof), publicInputs],
      });
      assert.equal(adapterValid, true, "deployed Honk verifier adapter rejected proof");
      return { proof: toHex(generated.proof), publicInputs, commitment };
    }

    const supplierProof = await proveAndIssue(supplier, "1250");
    const wrongChain = [...supplierProof.publicInputs];
    wrongChain[7] = 46_630n;
    await expectRevert(() => publicClient.simulateContract({
      account: supplier, address: pool, abi: poolArtifact.abi, functionName: "supply",
      args: [loanToken, 100n * loanUnit, supplierProof.proof, wrongChain],
    }), "WrongChain");
    const wrongPool = [...supplierProof.publicInputs];
    wrongPool[8] = BigInt(collateralToken);
    await expectRevert(() => publicClient.simulateContract({
      account: supplier, address: pool, abi: poolArtifact.abi, functionName: "supply",
      args: [loanToken, 100n * loanUnit, supplierProof.proof, wrongPool],
    }), "WrongLendingPool");

    await writeAndWait(supplierWallet, loanToken, tokenArtifact.abi, "approve", [pool, 100n * loanUnit]);
    const supply = await writeAndWait(supplierWallet, pool, poolArtifact.abi, "supply", [
      loanToken, 100n * loanUnit, supplierProof.proof, supplierProof.publicInputs,
    ]);
    const supplied = await publicClient.readContract({
      address: pool, abi: poolArtifact.abi, functionName: "getSupplyBalance", args: [supplier, loanToken],
    });
    assert.equal(supplied, 100n * loanUnit, "Mainnet-bound genuine proof did not authorize local demo supply.");

    const borrowerProof = await proveAndIssue(borrower, "1250");
    await writeAndWait(borrowerWallet, collateralToken, tokenArtifact.abi, "approve", [pool, 1_000n * collateralUnit]);
    await writeAndWait(borrowerWallet, pool, poolArtifact.abi, "depositCollateral", [collateralToken, 1_000n * collateralUnit]);
    await writeAndWait(borrowerWallet, pool, poolArtifact.abi, "setCollateralEnabled", [collateralToken, true, borrowerProof.proof, borrowerProof.publicInputs]);
    const borrow = await writeAndWait(borrowerWallet, pool, poolArtifact.abi, "borrow", [
      loanToken, 100n * loanUnit, borrowerProof.proof, borrowerProof.publicInputs,
    ]);
    const debt = await publicClient.readContract({
      address: pool, abi: poolArtifact.abi, functionName: "getDebtBalance", args: [borrower, loanToken],
    });
    assert.ok(debt >= 100n * loanUnit, "local verified borrow position was not recorded");

    process.stdout.write(JSON.stringify({
      result: "Genuine Noir/Barretenberg proof accepted by Mainnet-demo verifier and Lending pool",
      environment: "isolated local Anvil only; no Robinhood Mainnet RPC transactions or receipts",
      chainId,
      addresses: { registry, verifierAdapter, oracle, loanToken, collateralToken, pool },
      proofBinding: { policyId: policyId.toString(), chainId: chainId.toString(), lendingPool: pool, publicInputCount: RAY_INPUTS, verifierAccepted: true },
      localLifecycle: {
        supply: { transactionHash: supply.hash, status: "success", amount: String(100n * loanUnit) },
        borrow: { transactionHash: borrow.hash, status: "success", debt: debt.toString() },
      },
      wrongChainRejected: true,
      wrongPoolRejected: true,
      privateWitnessPrinted: false,
      externalBroadcast: false,
    }, null, 2) + "\n");

    async function writeAndWait(signingWallet, address, abi, functionName, args) {
      const { request } = await publicClient.simulateContract({
        account: signingWallet.account.address, address, abi, functionName, args,
      });
      const hash = await signingWallet.writeContract({ ...request, gas: 20_000_000n });
      const receipt = await waitReceipt(publicClient, hash);
      return { hash, receipt };
    }

    async function expectRevert(action, expectedName) {
      await assert.rejects(action(), (error) => {
        const message = `${error?.shortMessage ?? ""} ${error?.message ?? ""} ${error?.cause?.message ?? ""}`;
        assert.match(message, new RegExp(expectedName, "i"));
        return true;
      });
    }
  } finally {
    await bb?.destroy();
    anvil.kill("SIGTERM");
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
