import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  parseEventLogs,
  toHex,
} from "viem";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { controlledTokenAbi, credentialRegistryAbi, lendingPoolAbi } from "../../src/lib/contracts/abis.ts";
import {
  computeEligibilityCommitment,
  DEMO_COMMITMENT_DOMAIN_TAG,
  generateFieldSalt,
} from "../../src/lib/zk/commitment.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactsRoot = path.resolve(root, "contracts/out");
const crsPath = path.resolve(root, "circuits/cache/bb-crs");
const chain = defineChain({
  id: 91_342,
  name: "GIWA Lending Local Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
});
const tokenAdminAbi = parseAbi(["function mint(address account, uint256 amount)"]);
const roleAbi = parseAbi([
  "function ISSUER_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account)",
]);
const loanAssetArgs = ["GIWA Demo Lending Dollar", "gUSD", 6, 10n ** 15n];
const collateralAssetArgs = ["GIWA Demo Collateral", "gCOL", 18, 10n ** 27n];
const loanUnit = 10n ** 6n;
const collateralUnit = 10n ** 18n;
const supplyAmount = 10_000n * loanUnit;
const collateralAmount = 1_000n * collateralUnit;

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function loadArtifact(relativePath) {
  return JSON.parse(await readFile(path.join(artifactsRoot, relativePath), "utf8"));
}

async function main() {
  await mkdir(crsPath, { recursive: true });
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", [
    "--silent", "--host", "127.0.0.1", "--port", String(port), "--chain-id", "91342",
    "--accounts", "8", "--gas-limit", "100000000", "--disable-code-size-limit",
  ], { stdio: "ignore" });

  let api;
  try {
    const publicClient = createPublicClient({ chain: { ...chain, rpcUrls: { default: { http: [rpcUrl] } } }, transport: http(rpcUrl) });
    for (let attempt = 0; attempt < 80; attempt++) {
      if (anvil.exitCode !== null) throw new Error(`Anvil exited with status ${anvil.exitCode}.`);
      try {
        if (await publicClient.getChainId() === 91_342) break;
      } catch {}
      if (attempt === 79) throw new Error("Local Anvil did not become ready.");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const accountsResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_accounts", params: [] }),
    });
    const { result: accounts } = await accountsResponse.json();
    assert.ok(accounts.length >= 5, "Anvil should expose local test accounts.");
    const [admin, issuer, supplier, borrower] = accounts;
    const walletFor = (account) => createWalletClient({ account, chain: { ...chain, rpcUrls: { default: { http: [rpcUrl] } } }, transport: http(rpcUrl) });
    const adminWallet = walletFor(admin);
    const issuerWallet = walletFor(issuer);
    const supplierWallet = walletFor(supplier);
    const borrowerWallet = walletFor(borrower);
    const libraryAddresses = new Map();

    const deploy = async (artifactPath, args = [], wallet = adminWallet) => {
      const artifact = await loadArtifact(artifactPath);
      const bytecode = await linkBytecode(artifact);
      const hash = await wallet.deployContract({ abi: artifact.abi, bytecode, args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", `${artifactPath} deployment failed.`);
      assert.ok(receipt.contractAddress, `${artifactPath} did not return a contract address.`);
      return receipt.contractAddress;
    };

    async function linkBytecode(artifact) {
      let object = artifact.bytecode.object.replace(/^0x/, "");
      const refs = Object.entries(artifact.bytecode.linkReferences ?? [])
        .flatMap(([source, libraries]) => Object.entries(libraries)
          .flatMap(([libraryName, references]) => references.map((reference) => ({ source, libraryName, reference }))))
        .sort((left, right) => left.reference.start - right.reference.start);
      const placeholders = [...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)];
      assert.equal(placeholders.length, refs.length, "Solidity library placeholders do not match artifact links.");
      const resolved = [];
      for (const [index, entry] of refs.entries()) {
        const libraryArtifactPath = `${path.basename(entry.source)}/${entry.libraryName}.json`;
        let address = libraryAddresses.get(libraryArtifactPath);
        if (!address) {
          address = await deploy(libraryArtifactPath);
          libraryAddresses.set(libraryArtifactPath, address);
        }
        resolved.push({ index: placeholders[index].index, placeholder: placeholders[index][0], address });
      }
      for (const link of resolved.sort((left, right) => right.index - left.index)) {
        object = `${object.slice(0, link.index)}${link.address.slice(2).toLowerCase()}${object.slice(link.index + link.placeholder.length)}`;
      }
      assert.equal([...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)].length, 0, "Unresolved library link remains.");
      return `0x${object}`;
    }

    const registry = await deploy("DemoCredentialRegistry.sol/DemoCredentialRegistry.json");
    const generatedVerifier = await deploy("EligibilityHonkVerifier.sol/HonkVerifier.json");
    const adapter = await deploy("EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json", [generatedVerifier]);
    const lendingAsset = await deploy("ControlledTestToken.sol/ControlledTestToken.json", [...loanAssetArgs, admin]);
    const collateralAsset = await deploy("ControlledTestToken.sol/ControlledTestToken.json", [...collateralAssetArgs, admin]);
    const pool = await deploy("LendingPool.sol/LendingPool.json", [registry, adapter, lendingAsset, collateralAsset]);

    const issuerRole = await publicClient.readContract({ address: registry, abi: roleAbi, functionName: "ISSUER_ROLE" });
    await transact(adminWallet, registry, roleAbi, "grantRole", [issuerRole, issuer], publicClient);

    const privateValue = "1250";
    const salt = generateFieldSalt();
    const latestBlock = await publicClient.getBlock();
    const expiresAt = latestBlock.timestamp + 3_600n;
    const commitment = await computeEligibilityCommitment({
      subject: borrower,
      privateValue,
      salt,
      policyId: 2n,
      policyVersion: 1n,
      threshold: 1_000n,
      credentialVersion: 1n,
      expiresAt,
      chainId: 91_342n,
      vault: pool,
    });
    const issueReceipt = await transact(issuerWallet, registry, credentialRegistryAbi, "recordCredential", [
      borrower, 2n, commitment, expiresAt, 1n,
    ], publicClient);
    const credential = await publicClient.readContract({
      address: registry, abi: credentialRegistryAbi, functionName: "getCredential", args: [borrower, 2n],
    });
    assert.equal(credential.commitment.toLowerCase(), commitment.toLowerCase(), "Credential readback did not match commitment.");
    assert.equal(credential.issuer.toLowerCase(), issuer.toLowerCase(), "Credential issuer readback mismatch.");

    const circuit = JSON.parse(await readFile(path.join(root, "public/circuits/private_eligibility.json"), "utf8"));
    api = await Barretenberg.new({ threads: 1, crsPath });
    const noir = new Noir(circuit);
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const context = {
      subject: BigInt(borrower).toString(),
      commitment: BigInt(commitment).toString(),
      policy_id: "2",
      policy_version: "1",
      threshold: "1000",
      credential_version: "1",
      expires_at: expiresAt.toString(),
      chain_id: "91342",
      vault_address: BigInt(pool).toString(),
    };
    const proofInput = { ...context, private_value: privateValue, salt: BigInt(salt).toString() };
    const { witness } = await noir.execute(proofInput);
    const generated = await backend.generateProof(witness, { verifierTarget: "evm" });
    assert.equal(await backend.verifyProof(generated, { verifierTarget: "evm" }), true, "Local Barretenberg verification failed.");
    const publicInputs = generated.publicInputs.map(BigInt);
    const expectedPublicInputs = [BigInt(borrower), BigInt(commitment), 2n, 1n, 1_000n, 1n, expiresAt, 91_342n, BigInt(pool)];
    assert.deepEqual(publicInputs, expectedPublicInputs, "Generated proof public inputs are not lending-domain bound.");
    const belowThresholdCommitment = await computeUncheckedCommitment(api, {
      subject: borrower,
      privateValue: 999n,
      salt: BigInt(salt),
      policyId: 2n,
      policyVersion: 1n,
      threshold: 1_000n,
      credentialVersion: 1n,
      expiresAt,
      chainId: 91_342n,
      vault: pool,
    });
    await assert.rejects(noir.execute({
      ...proofInput,
      commitment: BigInt(belowThresholdCommitment).toString(),
      private_value: "999",
    }), "Under-threshold witness unexpectedly executed.");
    const proof = toHex(generated.proof);

    const receipts = { credential: receiptSummary(issueReceipt) };
    await transact(adminWallet, lendingAsset, tokenAdminAbi, "mint", [supplier, supplyAmount], publicClient);
    await transact(adminWallet, collateralAsset, tokenAdminAbi, "mint", [borrower, collateralAmount], publicClient);
    receipts.approveLending = receiptSummary(await transact(supplierWallet, lendingAsset, controlledTokenAbi, "approve", [pool, supplyAmount], publicClient));
    receipts.supply = receiptSummary(await transact(supplierWallet, pool, lendingPoolAbi, "supply", [supplyAmount], publicClient));
    receipts.approveCollateral = receiptSummary(await transact(borrowerWallet, collateralAsset, controlledTokenAbi, "approve", [pool, collateralAmount], publicClient));
    receipts.depositCollateral = receiptSummary(await transact(borrowerWallet, pool, lendingPoolAbi, "depositCollateral", [collateralAmount], publicClient));

    const invalidProof = `0x01${proof.slice(4)}`;
    const invalidProofRejected = await publicClient.simulateContract({
      account: borrower, address: pool, abi: lendingPoolAbi, functionName: "borrow",
      args: [1n, invalidProof, generated.publicInputs],
    }).then(() => false, () => true);
    assert.equal(invalidProofRejected, true, "Generated Solidity verifier accepted corrupted proof bytes.");

    const borrowReceipt = await transact(borrowerWallet, pool, lendingPoolAbi, "borrow", [
      500n * loanUnit, proof, publicInputs,
    ], publicClient);
    assertEvent(borrowReceipt.receipt, pool, lendingPoolAbi, "Borrowed");
    receipts.borrow = receiptSummary(borrowReceipt);
    const excessiveBorrowRejected = await publicClient.simulateContract({
      account: borrower, address: pool, abi: lendingPoolAbi, functionName: "borrow",
      args: [1n, proof, generated.publicInputs],
    }).then(() => false, () => true);
    assert.equal(excessiveBorrowRejected, true, "The market accepted borrowing above the live LTV limit.");

    receipts.approveRepayment = receiptSummary(await transact(borrowerWallet, lendingAsset, controlledTokenAbi, "approve", [pool, 500n * loanUnit], publicClient));
    const partialRepayReceipt = await transact(borrowerWallet, pool, lendingPoolAbi, "repay", [200n * loanUnit], publicClient);
    assertEvent(partialRepayReceipt.receipt, pool, lendingPoolAbi, "Repaid");
    receipts.partialRepay = receiptSummary(partialRepayReceipt);
    const partialWithdrawReceipt = await transact(borrowerWallet, pool, lendingPoolAbi, "withdrawCollateral", [400n * collateralUnit], publicClient);
    assertEvent(partialWithdrawReceipt.receipt, pool, lendingPoolAbi, "CollateralWithdrawn");
    receipts.partialCollateralWithdraw = receiptSummary(partialWithdrawReceipt);
    const finalRepayReceipt = await transact(borrowerWallet, pool, lendingPoolAbi, "repay", [300n * loanUnit], publicClient);
    assertEvent(finalRepayReceipt.receipt, pool, lendingPoolAbi, "Repaid");
    receipts.finalRepay = receiptSummary(finalRepayReceipt);
    const finalWithdrawReceipt = await transact(borrowerWallet, pool, lendingPoolAbi, "withdrawCollateral", [600n * collateralUnit], publicClient);
    assertEvent(finalWithdrawReceipt.receipt, pool, lendingPoolAbi, "CollateralWithdrawn");
    receipts.finalCollateralWithdraw = receiptSummary(finalWithdrawReceipt);
    const supplierWithdrawReceipt = await transact(supplierWallet, pool, lendingPoolAbi, "withdrawSupply", [supplyAmount], publicClient);
    assertEvent(supplierWithdrawReceipt.receipt, pool, lendingPoolAbi, "LiquidityWithdrawn");
    receipts.supplierWithdraw = receiptSummary(supplierWithdrawReceipt);

    const [finalDebt, finalCollateral, finalSupplierPosition, finalLiquidity, borrowerLoanBalance, borrowerCollateralBalance, supplierBalance] = await Promise.all([
      publicClient.readContract({ address: pool, abi: lendingPoolAbi, functionName: "debtBalance", args: [borrower] }),
      publicClient.readContract({ address: pool, abi: lendingPoolAbi, functionName: "collateralBalance", args: [borrower] }),
      publicClient.readContract({ address: pool, abi: lendingPoolAbi, functionName: "supplierBalance", args: [supplier] }),
      publicClient.readContract({ address: pool, abi: lendingPoolAbi, functionName: "availableLiquidity" }),
      publicClient.readContract({ address: lendingAsset, abi: controlledTokenAbi, functionName: "balanceOf", args: [borrower] }),
      publicClient.readContract({ address: collateralAsset, abi: controlledTokenAbi, functionName: "balanceOf", args: [borrower] }),
      publicClient.readContract({ address: lendingAsset, abi: controlledTokenAbi, functionName: "balanceOf", args: [supplier] }),
    ]);
    assert.equal(finalDebt, 0n);
    assert.equal(finalCollateral, 0n);
    assert.equal(finalSupplierPosition, 0n);
    assert.equal(finalLiquidity, 0n);
    assert.equal(borrowerLoanBalance, 0n);
    assert.equal(borrowerCollateralBalance, collateralAmount);
    assert.equal(supplierBalance, supplyAmount);
    process.stdout.write(JSON.stringify({
      result: "local Anvil lending lifecycle completed with real token transfers and generated proof",
      chainId: 91_342,
      addresses: { registry, generatedVerifier, adapter, lendingAsset, collateralAsset, lendingPool: pool },
      credential: { issuer, subject: borrower, policyId: "2", commitment, issuerReadback: credential.issuer },
      proof: { localVerification: "verified", onchainVerification: "accepted", publicInputCount: generated.publicInputs.length, proofBytes: generated.proof.length },
      rejected: { underThresholdWitness: true, corruptedProof: invalidProofRejected, borrowingAboveLtv: excessiveBorrowRejected },
      finalPosition: {
        borrowerDebt: finalDebt.toString(),
        borrowerCollateralInPool: finalCollateral.toString(),
        borrowerLoanTokenBalance: borrowerLoanBalance.toString(),
        borrowerCollateralTokenBalance: borrowerCollateralBalance.toString(),
        supplierPosition: finalSupplierPosition.toString(),
        supplierLoanTokenBalance: supplierBalance.toString(),
        availableLiquidity: finalLiquidity.toString(),
      },
      receipts,
      externalDeployment: false,
    }, null, 2) + "\n");
  } finally {
    await api?.destroy();
    anvil.kill("SIGTERM");
  }
}

async function transact(wallet, address, abi, functionName, args, publicClient) {
  const { request } = await publicClient.simulateContract({
    account: wallet.account.address,
    address,
    abi,
    functionName,
    args,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", `${functionName} transaction reverted.`);
  return { hash, receipt };
}

function receiptSummary({ hash, receipt }) {
  return { hash, status: receipt.status, blockNumber: receipt.blockNumber.toString(), logCount: receipt.logs.length };
}

function assertEvent(receipt, address, abi, eventName) {
  const decoded = parseEventLogs({ abi, address, logs: receipt.logs, strict: false });
  assert.ok(decoded.some((event) => event.eventName === eventName), `Receipt did not include ${eventName}.`);
}

async function computeUncheckedCommitment(api, input) {
  const fields = [
    DEMO_COMMITMENT_DOMAIN_TAG,
    input.privateValue,
    input.salt,
    BigInt(input.subject),
    input.policyId,
    input.policyVersion,
    input.threshold,
    input.credentialVersion,
    input.expiresAt,
    input.chainId,
    BigInt(input.vault),
  ];
  const { hash } = await api.pedersenHash({
    inputs: fields.map((value) => {
      const bytes = value.toString(16).padStart(64, "0");
      return Uint8Array.from(bytes.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
    }),
    hashIndex: 0,
  });
  return `0x${Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
