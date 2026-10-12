import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEventLogs,
  toFunctionSelector,
  toHex,
} from "viem";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import {
  controlledTestOracleAbi,
  controlledTokenAbi,
  credentialRegistryAbi,
  lendingPoolV2Abi,
} from "../../src/lib/contracts/abis.ts";
import {
  computeEligibilityCommitment,
  generateFieldSalt,
} from "../../src/lib/zk/commitment.ts";
import { readLendingV2Market } from "../../src/lib/lending/v2-service.ts";
import {
  readRobinhoodGovernanceProposalPage,
  readRobinhoodGovernanceSnapshot,
} from "../../src/lib/governance/robinhood-service.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactsRoot = path.resolve(root, "contracts/out");
const crsPath = path.resolve(root, "circuits/cache/bb-crs");
const chainId = Number(process.env.LENDING_V2_TEST_CHAIN_ID ?? "91342");
assert.ok([91_342, 46_630].includes(chainId), `Unsupported Lending V2 test chain ${chainId}.`);
const chain = defineChain({
  id: chainId,
  name: chainId === 46_630 ? "Robinhood Testnet Lending V2 Local Anvil" : "GIWA Lending V2 Local Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
});
const tokenMintAbi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [
    { name: "account", type: "address" }, { name: "amount", type: "uint256" },
  ], outputs: [] },
];
const roleAbi = [
  { type: "function", name: "ISSUER_ROLE", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  { type: "function", name: "grantRole", stateMutability: "nonpayable", inputs: [
    { name: "role", type: "bytes32" }, { name: "account", type: "address" },
  ], outputs: [] },
];
const loanUnit = 10n ** 6n;
const collateralUnit = 10n ** 18n;
const policyId = 3n;
const policyVersion = 1n;
const threshold = 1_000n;
const loanSupply = 10_000n * loanUnit;
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

async function rpc(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const result = await response.json();
  if (result.error) throw new Error(`${method} failed: ${result.error.message}`);
  return result.result;
}

async function main() {
  await mkdir(crsPath, { recursive: true });
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", [
    "--silent", "--host", "127.0.0.1", "--port", String(port), "--chain-id", String(chainId),
    "--accounts", "10", "--gas-limit", "100000000",
  ], { stdio: "ignore" });

  let api;
  try {
    const localChain = { ...chain, rpcUrls: { default: { http: [rpcUrl] } } };
    const publicClient = createPublicClient({ chain: localChain, transport: http(rpcUrl) });
    for (let attempt = 0; attempt < 80; attempt++) {
      if (anvil.exitCode !== null) throw new Error(`Anvil exited with status ${anvil.exitCode}.`);
      try {
        if (await publicClient.getChainId() === chainId) break;
      } catch {}
      if (attempt === 79) throw new Error("Local Anvil did not become ready.");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const accounts = await rpc(rpcUrl, "eth_accounts");
    assert.ok(accounts.length >= 7, "Anvil should expose seven local test accounts.");
    assert.ok(accounts.length >= 8, "Anvil should expose eight local test accounts.");
    const [admin, issuer, supplier, borrower, liquidator, liquidationBorrower, staleOracleBorrower, daoVoter] = accounts;
    const walletFor = (account) => createWalletClient({ account, chain: localChain, transport: http(rpcUrl) });
    const adminWallet = walletFor(admin);
    const issuerWallet = walletFor(issuer);
    const supplierWallet = walletFor(supplier);
    const borrowerWallet = walletFor(borrower);
    const liquidatorWallet = walletFor(liquidator);
    const liquidationBorrowerWallet = walletFor(liquidationBorrower);
    const linkedLibraries = new Map();

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
      const references = Object.entries(artifact.bytecode.linkReferences ?? [])
        .flatMap(([source, libraries]) => Object.entries(libraries)
          .flatMap(([libraryName, locations]) => locations.map((location) => ({ source, libraryName, location }))))
        .sort((a, b) => a.location.start - b.location.start);
      const placeholders = [...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)];
      assert.equal(placeholders.length, references.length, "Solidity library placeholders do not match artifact links.");
      const replacements = [];
      for (const [index, entry] of references.entries()) {
        const libraryArtifactPath = `${path.basename(entry.source)}/${entry.libraryName}.json`;
        let address = linkedLibraries.get(libraryArtifactPath);
        if (!address) {
          address = await deploy(libraryArtifactPath);
          linkedLibraries.set(libraryArtifactPath, address);
        }
        replacements.push({ index: placeholders[index].index, placeholder: placeholders[index][0], address });
      }
      for (const replacement of replacements.sort((a, b) => b.index - a.index)) {
        object = `${object.slice(0, replacement.index)}${replacement.address.slice(2).toLowerCase()}${object.slice(replacement.index + replacement.placeholder.length)}`;
      }
      assert.equal([...object.matchAll(/__\$[a-fA-F0-9]{34}\$__/g)].length, 0, "Unresolved library link remains.");
      return `0x${object}`;
    }

    const registryArtifact = chainId === 46_630
      ? "RobinhoodDemoCredentialRegistry.sol/RobinhoodDemoCredentialRegistry.json"
      : "DemoCredentialRegistry.sol/DemoCredentialRegistry.json";
    const registry = await deploy(registryArtifact);
    const generatedVerifier = await deploy("EligibilityHonkVerifier.sol/HonkVerifier.json");
    const verifierAdapter = await deploy("EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json", [generatedVerifier]);
    const lendingAsset = await deploy("ControlledTestToken.sol/ControlledTestToken.json", [
      `${chainId === 46_630 ? "Robinhood" : "GIWA"} Demo Lending Dollar V2`, "gUSD2", 6, 1_000_000n * loanUnit, admin,
    ]);
    const collateralAsset = await deploy("ControlledTestToken.sol/ControlledTestToken.json", [
      `${chainId === 46_630 ? "Robinhood" : "GIWA"} Demo Collateral V2`, "gCOL2", 18, 1_000_000n * collateralUnit, admin,
    ]);
    const testOracle = await deploy("ControlledTestOracle.sol/ControlledTestOracle.json", [admin]);
    const lendingPool = await deploy("LendingPoolV2.sol/LendingPoolV2.json", [
      registry, verifierAdapter, testOracle, admin,
    ]);

    const receipts = {};
    const issuerRole = await publicClient.readContract({
      address: registry, abi: roleAbi, functionName: "ISSUER_ROLE",
    });
    receipts.issuerRole = receiptSummary(await transact(adminWallet, registry, roleAbi, "grantRole", [issuerRole, issuer], publicClient));
    runFoundryDeploymentSimulation({ rpcUrl, admin, issuer, registry, verifierAdapter, generatedVerifier, chainId });

    // These prices exist only in this isolated Anvil fixture. They are not market observations.
    receipts.loanBounds = receiptSummary(await transact(adminWallet, testOracle, controlledTestOracleAbi,
      "setPriceBounds", [lendingAsset, 950_000_000_000_000_000n, 1_050_000_000_000_000_000n], publicClient));
    receipts.collateralBounds = receiptSummary(await transact(adminWallet, testOracle, controlledTestOracleAbi,
      "setPriceBounds", [collateralAsset, 500_000_000_000_000_000n, 4_000_000_000_000_000_000n], publicClient));
    receipts.initialLoanPrice = receiptSummary(await transact(adminWallet, testOracle, controlledTestOracleAbi,
      "setPrice", [lendingAsset, 1_000_000_000_000_000_000n], publicClient));
    receipts.initialCollateralPrice = receiptSummary(await transact(adminWallet, testOracle, controlledTestOracleAbi,
      "setPrice", [collateralAsset, 2_000_000_000_000_000_000n], publicClient));

    const loanConfig = {
      supplyCap: 100_000n * loanUnit,
      borrowCap: 50_000n * loanUnit,
      collateralCap: 0n,
      minBorrowAmount: 1n * loanUnit,
      maxOracleAge: 3_600,
      maxLtvBps: 5_000,
      liquidationThresholdBps: 6_500,
      liquidationBonusBps: 500,
      closeFactorBps: 5_000,
      reserveFactorBps: 1_000,
      optimalUtilizationBps: 8_000,
      baseBorrowRateBps: 200,
      slope1Bps: 400,
      slope2Bps: 6_000,
      active: true,
      supplyEnabled: true,
      borrowEnabled: true,
      collateralEnabled: false,
    };
    const collateralConfig = {
      ...loanConfig,
      supplyCap: 0n,
      borrowCap: 0n,
      collateralCap: 100_000n * collateralUnit,
      minBorrowAmount: 0n,
      active: true,
      supplyEnabled: false,
      borrowEnabled: false,
      collateralEnabled: true,
    };
    receipts.configureLoan = receiptSummary(await transact(adminWallet, lendingPool, lendingPoolV2Abi,
      "configureReserve", [lendingAsset, loanConfig], publicClient));
    receipts.configureCollateral = receiptSummary(await transact(adminWallet, lendingPool, lendingPoolV2Abi,
      "configureReserve", [collateralAsset, collateralConfig], publicClient));

    const initialMarket = await readLendingV2Market(publicClient, { pool: lendingPool, wallet: supplier, expectedRegistry: registry, expectedChainId: chainId });
    assert.equal(initialMarket.policyId, 3n, "Typed market adapter did not resolve policy 3.");
    assert.equal(initialMarket.riskPaused, false, "New local V2 pool is unexpectedly paused.");
    assert.equal(initialMarket.reserves.find((reserve) => reserve.asset.toLowerCase() === lendingAsset.toLowerCase())?.symbol, "gUSD2");
    assert.equal(initialMarket.reserves.find((reserve) => reserve.asset.toLowerCase() === collateralAsset.toLowerCase())?.decimals, 18);
    assert.ok(initialMarket.reserves.every((reserve) => reserve.oracle.state === "fresh"), "Typed adapter did not report seeded local prices as fresh.");

    const circuit = JSON.parse(await readFile(path.join(root, "public/circuits/private_eligibility.json"), "utf8"));
    api = await Barretenberg.new({ threads: 1, crsPath });
    const noir = new Noir(circuit);
    const backend = new UltraHonkBackend(circuit.bytecode, api);

    const proofFor = async (subject, privateValue) => {
      const salt = generateFieldSalt();
      const currentBlock = await publicClient.getBlock();
      const expiresAt = currentBlock.timestamp + 86_400n;
      const previous = await publicClient.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [subject, policyId],
      });
      const version = previous.wallet === "0x0000000000000000000000000000000000000000"
        ? 1n : previous.version + 1n;
      const commitment = await computeEligibilityCommitment({
        subject, privateValue, salt, policyId, policyVersion, threshold,
        credentialVersion: version, expiresAt, chainId: BigInt(chainId), vault: lendingPool,
      });
      const issue = await transact(issuerWallet, registry, credentialRegistryAbi, "recordCredential", [
        subject, policyId, commitment, expiresAt, version,
      ], publicClient);
      const context = {
        subject: BigInt(subject).toString(),
        commitment: BigInt(commitment).toString(),
        policy_id: policyId.toString(),
        policy_version: policyVersion.toString(),
        threshold: threshold.toString(),
        credential_version: version.toString(),
        expires_at: expiresAt.toString(),
        chain_id: String(chainId),
        vault_address: BigInt(lendingPool).toString(),
      };
      const { witness } = await noir.execute({ ...context, private_value: privateValue, salt: BigInt(salt).toString() });
      const generated = await backend.generateProof(witness, { verifierTarget: "evm" });
      assert.equal(await backend.verifyProof(generated, { verifierTarget: "evm" }), true, "Local Barretenberg proof verification failed.");
      const expected = [BigInt(subject), BigInt(commitment), policyId, policyVersion, threshold,
        version, expiresAt, BigInt(chainId), BigInt(lendingPool)];
      const publicInputs = generated.publicInputs.map(BigInt);
      assert.deepEqual(publicInputs, expected, "Proof public inputs are not bound to this V2 pool and policy.");
      const record = await publicClient.readContract({
        address: registry, abi: credentialRegistryAbi, functionName: "getCredential", args: [subject, policyId],
      });
      assert.equal(record.commitment.toLowerCase(), commitment.toLowerCase(), "Credential commitment readback mismatch.");
      assert.equal(record.issuer.toLowerCase(), issuer.toLowerCase(), "Credential issuer readback mismatch.");
      return {
        proof: toHex(generated.proof),
        publicInputs,
        commitment,
        issue,
        version,
        expiresAt,
        publicInputCount: publicInputs.length,
        proofByteLength: generated.proof.length,
      };
    };

    const supplierProof = await proofFor(supplier, "1250");
    const receiptsForLifecycle = {};
    receipts.mintSupply = receiptSummary(await transact(adminWallet, lendingAsset, tokenMintAbi,
      "mint", [supplier, loanSupply], publicClient));
    receiptsForLifecycle.approveSupply = receiptSummary(await transact(supplierWallet, lendingAsset,
      controlledTokenAbi, "approve", [lendingPool, loanSupply], publicClient));
    const supplyTx = await transact(supplierWallet, lendingPool, lendingPoolV2Abi, "supply",
      [lendingAsset, loanSupply, supplierProof.proof, supplierProof.publicInputs], publicClient);
    assertEvent(supplyTx.receipt, lendingPool, lendingPoolV2Abi, "LiquiditySupplied");
    receiptsForLifecycle.supply = receiptSummary(supplyTx);
    const suppliedMarket = await readLendingV2Market(publicClient, { pool: lendingPool, wallet: supplier, expectedRegistry: registry, expectedChainId: chainId });
    assert.ok(suppliedMarket.position.byAsset[lendingAsset.toLowerCase()].supplied > 0n, "Typed adapter did not refresh the supplier position.");
    assert.ok(suppliedMarket.reserves.find((reserve) => reserve.asset.toLowerCase() === lendingAsset.toLowerCase())?.data.availableLiquidity > 0n);

    receiptsForLifecycle.mintCollateral = receiptSummary(await transact(adminWallet, collateralAsset,
      tokenMintAbi, "mint", [borrower, collateralAmount], publicClient));
    receiptsForLifecycle.mintRepayBuffer = receiptSummary(await transact(adminWallet, lendingAsset,
      tokenMintAbi, "mint", [borrower, 20n * loanUnit], publicClient));
    receiptsForLifecycle.approveCollateral = receiptSummary(await transact(borrowerWallet, collateralAsset,
      controlledTokenAbi, "approve", [lendingPool, collateralAmount], publicClient));
    const depositTx = await transact(borrowerWallet, lendingPool, lendingPoolV2Abi, "depositCollateral",
      [collateralAsset, collateralAmount], publicClient);
    assertEvent(depositTx.receipt, lendingPool, lendingPoolV2Abi, "CollateralDeposited");
    receiptsForLifecycle.depositCollateral = receiptSummary(depositTx);

    const borrowerProof = await proofFor(borrower, "1250");
    const wrongPolicyInputs = [...borrowerProof.publicInputs];
    wrongPolicyInputs[2] = 2n;
    await expectSimulationFailure(() => publicClient.simulateContract({
      account: borrower,
      address: lendingPool,
      abi: lendingPoolV2Abi,
      functionName: "borrow",
      args: [lendingAsset, loanUnit, borrowerProof.proof, wrongPolicyInputs],
    }), /wrongpolicy/i, "V2 must reject a policy-2 proof domain.");
    const wrongPoolInputs = [...borrowerProof.publicInputs];
    wrongPoolInputs[8] = BigInt(collateralAsset);
    await expectSimulationFailure(() => publicClient.simulateContract({
      account: borrower,
      address: lendingPool,
      abi: lendingPoolV2Abi,
      functionName: "borrow",
      args: [lendingAsset, loanUnit, borrowerProof.proof, wrongPoolInputs],
    }), /wronglendingpool/i, "V2 must reject a proof bound to a different contract address.");
    await expectSimulationFailure(() => publicClient.simulateContract({
      account: borrower,
      address: lendingPool,
      abi: lendingPoolV2Abi,
      functionName: "borrow",
      args: [lendingAsset, loanUnit, "0x1234", borrowerProof.publicInputs],
    }), undefined, "The local verifier must reject malformed proof bytes.");
    const enableTx = await transact(borrowerWallet, lendingPool, lendingPoolV2Abi, "setCollateralEnabled",
      [collateralAsset, true, borrowerProof.proof, borrowerProof.publicInputs], publicClient);
    assertEvent(enableTx.receipt, lendingPool, lendingPoolV2Abi, "CollateralUseChanged");
    receiptsForLifecycle.enableCollateral = receiptSummary(enableTx);
    const borrowTx = await transact(borrowerWallet, lendingPool, lendingPoolV2Abi, "borrow",
      [lendingAsset, 500n * loanUnit, borrowerProof.proof, borrowerProof.publicInputs], publicClient);
    assertEvent(borrowTx.receipt, lendingPool, lendingPoolV2Abi, "Borrowed");
    receiptsForLifecycle.borrow = receiptSummary(borrowTx);
    const borrowedMarket = await readLendingV2Market(publicClient, { pool: lendingPool, wallet: borrower, expectedRegistry: registry, expectedChainId: chainId });
    assert.ok(borrowedMarket.position.byAsset[lendingAsset.toLowerCase()].debt > 0n, "Typed adapter did not refresh borrower debt.");
    assert.ok(borrowedMarket.position.account?.healthFactorWad, "Typed adapter omitted fresh account health data.");
    assert.ok(borrowedMarket.reserves.find((reserve) => reserve.asset.toLowerCase() === lendingAsset.toLowerCase())?.maxBorrowable !== undefined, "Typed adapter omitted the price-gated borrow limit.");

    const debtBeforeAccrual = await publicClient.readContract({
      address: lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [borrower, lendingAsset],
    });
    await rpc(rpcUrl, "evm_increaseTime", [30 * 24 * 60 * 60]);
    await rpc(rpcUrl, "evm_mine");
    const debtAfterAccrual = await publicClient.readContract({
      address: lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [borrower, lendingAsset],
    });
    const supplierBalanceAfterAccrual = await publicClient.readContract({
      address: lendingPool, abi: lendingPoolV2Abi, functionName: "getSupplyBalance", args: [supplier, lendingAsset],
    });
    assert.ok(debtAfterAccrual > debtBeforeAccrual, "Debt did not accrue interest over the local time advance.");
    assert.ok(supplierBalanceAfterAccrual > loanSupply, "Supplier index did not accrue yield.");
    const rateData = await publicClient.readContract({
      address: lendingPool, abi: lendingPoolV2Abi, functionName: "getReserveData", args: [lendingAsset],
    });
    assert.ok(rateData.currentBorrowRateBps >= 200n, "Borrow rate is below configured base rate.");
    const staleMarket = await readLendingV2Market(publicClient, { pool: lendingPool, wallet: borrower, expectedRegistry: registry, expectedChainId: chainId });
    assert.ok(staleMarket.reserves.some((reserve) => reserve.oracle.state === "stale"), "Typed adapter did not report stale prices.");
    assert.equal(staleMarket.position.riskMetricsState, "blocked-by-oracle");
    assert.equal(staleMarket.position.account, undefined, "Stale prices must not produce health metrics.");
    assert.ok(staleMarket.position.byAsset[lendingAsset.toLowerCase()].debt > 0n, "Stale oracle state must retain the repayable debt read.");
    await expectSimulationFailure(() => publicClient.simulateContract({
      account: borrower,
      address: lendingPool,
      abi: lendingPoolV2Abi,
      functionName: "borrow",
      args: [lendingAsset, loanUnit, borrowerProof.proof, borrowerProof.publicInputs],
    }), /credentialexpired/i, "An expired policy-3 credential must not authorize borrow.");
    const freshCredentialStaleOracleProof = await proofFor(staleOracleBorrower, "1250");
    await expectSimulationFailure(() => publicClient.simulateContract({
      account: staleOracleBorrower,
      address: lendingPool,
      abi: lendingPoolV2Abi,
      functionName: "borrow",
      args: [lendingAsset, loanUnit, freshCredentialStaleOracleProof.proof, freshCredentialStaleOracleProof.publicInputs],
    }), /staleoracleprice/i, "A fresh credential must not bypass stale price checks.");

    // Refresh only the synthetic fixture prices after the local clock advance.
    receiptsForLifecycle.refreshLoanPrice = receiptSummary(await transact(adminWallet, testOracle,
      controlledTestOracleAbi, "setPrice", [lendingAsset, 1_000_000_000_000_000_000n], publicClient));
    receiptsForLifecycle.refreshCollateralPrice = receiptSummary(await transact(adminWallet, testOracle,
      controlledTestOracleAbi, "setPrice", [collateralAsset, 2_000_000_000_000_000_000n], publicClient));
    receiptsForLifecycle.approveRepayment = receiptSummary(await transact(borrowerWallet, lendingAsset,
      controlledTokenAbi, "approve", [lendingPool, (1n << 256n) - 1n], publicClient));
    const repayTx = await transact(borrowerWallet, lendingPool, lendingPoolV2Abi, "repay",
      [lendingAsset, (1n << 256n) - 1n], publicClient);
    assertEvent(repayTx.receipt, lendingPool, lendingPoolV2Abi, "Repaid");
    receiptsForLifecycle.fullRepay = receiptSummary(repayTx);
    const debtAfterRepay = await publicClient.readContract({
      address: lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [borrower, lendingAsset],
    });
    assert.equal(debtAfterRepay, 0n, "Full repayment left debt shares outstanding.");
    const withdrawCollateralTx = await transact(borrowerWallet, lendingPool, lendingPoolV2Abi,
      "withdrawCollateral", [collateralAsset, collateralAmount], publicClient);
    assertEvent(withdrawCollateralTx.receipt, lendingPool, lendingPoolV2Abi, "CollateralWithdrawn");
    receiptsForLifecycle.withdrawCollateral = receiptSummary(withdrawCollateralTx);
    const withdrawSupplyTx = await transact(supplierWallet, lendingPool, lendingPoolV2Abi,
      "withdrawSupply", [lendingAsset, 1_000n * loanUnit], publicClient);
    assertEvent(withdrawSupplyTx.receipt, lendingPool, lendingPoolV2Abi, "LiquidityWithdrawn");
    receiptsForLifecycle.withdrawSupply = receiptSummary(withdrawSupplyTx);
    const repaidMarket = await readLendingV2Market(publicClient, { pool: lendingPool, wallet: borrower, expectedRegistry: registry, expectedChainId: chainId });
    assert.equal(repaidMarket.position.byAsset[lendingAsset.toLowerCase()].debt, 0n, "Typed adapter did not refresh full repayment.");
    assert.equal(repaidMarket.position.byAsset[collateralAsset.toLowerCase()].collateral, 0n, "Typed adapter did not refresh the safe collateral exit.");

    const liquidationProof = await proofFor(liquidationBorrower, "1250");
    receipts.liquidationBorrowerCollateral = receiptSummary(await transact(adminWallet, collateralAsset,
      tokenMintAbi, "mint", [liquidationBorrower, collateralAmount], publicClient));
    receipts.liquidatorLoanTokens = receiptSummary(await transact(adminWallet, lendingAsset,
      tokenMintAbi, "mint", [liquidator, 1_000n * loanUnit], publicClient));
    receipts.liquidationBorrowerApprove = receiptSummary(await transact(liquidationBorrowerWallet, collateralAsset,
      controlledTokenAbi, "approve", [lendingPool, collateralAmount], publicClient));
    const liquidationDepositTx = await transact(liquidationBorrowerWallet, lendingPool,
      lendingPoolV2Abi, "depositCollateral", [collateralAsset, collateralAmount], publicClient);
    receipts.liquidationDeposit = receiptSummary(liquidationDepositTx);
    const liquidationEnableTx = await transact(liquidationBorrowerWallet, lendingPool,
      lendingPoolV2Abi, "setCollateralEnabled", [collateralAsset, true, liquidationProof.proof, liquidationProof.publicInputs], publicClient);
    receipts.liquidationEnable = receiptSummary(liquidationEnableTx);
    const liquidationBorrowTx = await transact(liquidationBorrowerWallet, lendingPool,
      lendingPoolV2Abi, "borrow", [lendingAsset, 900n * loanUnit, liquidationProof.proof, liquidationProof.publicInputs], publicClient);
    receipts.liquidationBorrow = receiptSummary(liquidationBorrowTx);

    receipts.syntheticPriceDrop = receiptSummary(await transact(adminWallet, testOracle,
      controlledTestOracleAbi, "setPrice", [collateralAsset, 1_200_000_000_000_000_000n], publicClient));
    const unhealthy = await publicClient.readContract({
      address: lendingPool, abi: lendingPoolV2Abi, functionName: "getAccountData", args: [liquidationBorrower],
    });
    assert.ok(unhealthy.healthFactorWad < 10n ** 27n, "Controlled local price move did not make the position unhealthy.");
    const unhealthyMarket = await readLendingV2Market(publicClient, { pool: lendingPool, wallet: liquidationBorrower, expectedRegistry: registry, expectedChainId: chainId });
    assert.equal(unhealthyMarket.position.liquidationEligible, true, "Typed adapter did not detect liquidation eligibility.");
    receipts.liquidatorApprove = receiptSummary(await transact(liquidatorWallet, lendingAsset,
      controlledTokenAbi, "approve", [lendingPool, 450n * loanUnit], publicClient));
    const liquidationTx = await transact(liquidatorWallet, lendingPool, lendingPoolV2Abi,
      "liquidate", [liquidationBorrower, lendingAsset, collateralAsset, 450n * loanUnit], publicClient);
    assertEvent(liquidationTx.receipt, lendingPool, lendingPoolV2Abi, "Liquidated");
    receipts.liquidation = receiptSummary(liquidationTx);
    const liquidationDebtAfter = await publicClient.readContract({
      address: lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [liquidationBorrower, lendingAsset],
    });
    const seizedCollateral = await publicClient.readContract({
      address: collateralAsset, abi: controlledTokenAbi, functionName: "balanceOf", args: [liquidator],
    });
    assert.ok(liquidationDebtAfter < 900n * loanUnit, "Liquidation did not reduce borrower debt.");
    assert.ok(seizedCollateral > 0n, "Liquidator did not receive collateral.");
    const liquidatedMarket = await readLendingV2Market(publicClient, { pool: lendingPool, wallet: liquidationBorrower, expectedRegistry: registry, expectedChainId: chainId });
    assert.ok(liquidatedMarket.position.byAsset[lendingAsset.toLowerCase()].debt < 900n * loanUnit, "Typed adapter did not refresh liquidation debt.");

    let governanceEvidence;
    if (chainId === 46_630) {
      const governanceArtifactPath = "RobinhoodGovernancePhase1.sol/RobinhoodGovernancePhase1.json";
      const governanceArtifact = await loadArtifact(governanceArtifactPath);
      const governance = await deploy(governanceArtifactPath, [registry, admin, 3_600, 2, 7 * 24 * 60 * 60, 0]);
      const governancePolicyId = 4n;
      const governanceMembers = [borrower, daoVoter];
      const emptyGovernancePage = await readRobinhoodGovernanceProposalPage(publicClient, governance, registry, { pageSize: 5 });
      assert.equal(emptyGovernancePage.state, "ready", "Robinhood proposal discovery did not confirm deployed code and registry.");
      assert.equal(emptyGovernancePage.page.totalProposals, 0n, "Empty Robinhood DAO was reported with a fake proposal count.");
      assert.equal(emptyGovernancePage.page.proposals.length, 0, "Empty Robinhood DAO returned a fabricated proposal.");
      const lendingCredentialStatus = await readRobinhoodGovernanceSnapshot(publicClient, governance, registry, borrower);
      assert.equal(lendingCredentialStatus.state, "ready");
      assert.equal(lendingCredentialStatus.snapshot.isVerifiedMember, false, "Lending policy 3 incorrectly granted governance membership.");
      assert.equal(lendingCredentialStatus.snapshot.credentialState, "missing", "DAO discovery did not enforce policy 4.");
      const credentialExpiry = (await publicClient.getBlock()).timestamp + 10n * 24n * 60n * 60n;
      assert.equal(await publicClient.readContract({
        address: governance,
        abi: governanceArtifact.abi,
        functionName: "isVerifiedMember",
        args: [borrower],
      }), false, "Lending policy 3 must not grant Robinhood DAO membership.");

      const daoReceipts = {};
      for (const [index, member] of governanceMembers.entries()) {
        const credentialHash = toHex(BigInt(index + 101), { size: 32 });
        daoReceipts[`issuePolicy4Credential${index + 1}`] = receiptSummary(await transact(
          issuerWallet,
          registry,
          credentialRegistryAbi,
          "recordCredential",
          [member, governancePolicyId, credentialHash, credentialExpiry, 1],
          publicClient,
        ));
        assert.equal(await publicClient.readContract({
          address: governance,
          abi: governanceArtifact.abi,
          functionName: "isVerifiedMember",
          args: [member],
        }), true, "Policy-4 issuer credential did not grant DAO membership.");
      }

      const createTx = await transact(
        borrowerWallet,
        governance,
        governanceArtifact.abi,
        "createProposal",
        ["local-e2e://phase1/protected-access-policy", 2 * 24 * 60 * 60],
        publicClient,
      );
      assertEvent(createTx.receipt, governance, governanceArtifact.abi, "ProposalCreated");
      daoReceipts.createProposal = receiptSummary(createTx);
      const proposalId = 1n;
      const timing = await publicClient.readContract({
        address: governance,
        abi: governanceArtifact.abi,
        functionName: "proposalTiming",
        args: [proposalId],
      });
      await expectSimulationFailure(() => publicClient.simulateContract({
        account: borrower,
        address: governance,
        abi: governanceArtifact.abi,
        functionName: "castVote",
        args: [proposalId, 1],
      }), /votingnotstarted/i, "DAO must reject a vote before the proposal's voting start.");

      await rpc(rpcUrl, "evm_increaseTime", [60]);
      await rpc(rpcUrl, "evm_mine");
      const firstVote = await transact(borrowerWallet, governance, governanceArtifact.abi,
        "castVote", [proposalId, 1], publicClient);
      assertEvent(firstVote.receipt, governance, governanceArtifact.abi, "VoteCast");
      daoReceipts.firstVote = receiptSummary(firstVote);
      await expectSimulationFailure(() => publicClient.simulateContract({
        account: borrower,
        address: governance,
        abi: governanceArtifact.abi,
        functionName: "castVote",
        args: [proposalId, 0],
      }), /alreadyvoted/i, "DAO must reject a duplicate vote from the same wallet.");
      const secondVote = await transact(walletFor(daoVoter), governance, governanceArtifact.abi,
        "castVote", [proposalId, 1], publicClient);
      assertEvent(secondVote.receipt, governance, governanceArtifact.abi, "VoteCast");
      daoReceipts.secondVote = receiptSummary(secondVote);

      const currentBlock = await publicClient.getBlock();
      const secondsToDeadline = timing[1] > currentBlock.timestamp ? Number(timing[1] - currentBlock.timestamp) : 0;
      if (secondsToDeadline > 0) await rpc(rpcUrl, "evm_increaseTime", [secondsToDeadline]);
      await rpc(rpcUrl, "evm_mine");
      const finalizeTx = await transact(adminWallet, governance, governanceArtifact.abi,
        "finalizeProposal", [proposalId], publicClient);
      assertEvent(finalizeTx.receipt, governance, governanceArtifact.abi, "ProposalFinalized");
      daoReceipts.finalize = receiptSummary(finalizeTx);
      const executeTx = await transact(adminWallet, governance, governanceArtifact.abi,
        "executeProposal", [proposalId], publicClient);
      assertEvent(executeTx.receipt, governance, governanceArtifact.abi, "ProposalExecuted");
      assertEvent(executeTx.receipt, governance, governanceArtifact.abi, "MinimumRemainingValidityChanged");
      daoReceipts.execute = receiptSummary(executeTx);

      const finalProposal = await publicClient.readContract({
        address: governance,
        abi: governanceArtifact.abi,
        functionName: "getProposal",
        args: [proposalId],
      });
      const finalState = await publicClient.readContract({
        address: governance,
        abi: governanceArtifact.abi,
        functionName: "proposalState",
        args: [proposalId],
      });
      assert.equal(finalProposal.finalized, true, "DAO proposal did not finalize.");
      assert.equal(finalProposal.approved, true, "DAO proposal did not meet its configured quorum.");
      assert.equal(finalProposal.executed, true, "DAO proposal did not execute.");
      assert.equal(finalState, 6, "DAO proposal did not reach Executed state.");
      const discoveredPage = await readRobinhoodGovernanceProposalPage(publicClient, governance, registry, { pageSize: 5, wallet: borrower });
      assert.equal(discoveredPage.state, "ready");
      assert.equal(discoveredPage.page.totalProposals, 1n, "Proposal discovery did not return the contract's actual proposal count.");
      assert.equal(discoveredPage.page.proposals.length, 1, "Proposal discovery did not return the actual proposal.");
      assert.equal(discoveredPage.page.proposals[0].id, proposalId);
      assert.equal(discoveredPage.page.proposals[0].state, "executed");
      assert.equal(discoveredPage.page.proposals[0].forVotes, 2n);
      assert.equal(discoveredPage.page.quorum, 2n);
      const activeCredentialSnapshot = await readRobinhoodGovernanceSnapshot(publicClient, governance, registry, borrower, proposalId);
      assert.equal(activeCredentialSnapshot.state, "ready");
      assert.equal(activeCredentialSnapshot.snapshot.isVerifiedMember, true);
      assert.equal(activeCredentialSnapshot.snapshot.credentialState, "active", "Current issuer-backed policy-4 credential was not recognized.");
      assert.equal(activeCredentialSnapshot.snapshot.credential?.issuer.toLowerCase(), issuer.toLowerCase());
      assert.equal(activeCredentialSnapshot.snapshot.credentialPolicyId, 4n);
      assert.equal(activeCredentialSnapshot.snapshot.proposal?.id, proposalId);
      assert.equal(activeCredentialSnapshot.snapshot.paused, false);
      assert.equal(await publicClient.readContract({
        address: governance,
        abi: governanceArtifact.abi,
        functionName: "minimumRemainingValidity",
      }), 2n * 24n * 60n * 60n, "DAO Phase 1 bounded action was not applied.");
      const protectedActionTx = await transact(borrowerWallet, governance, governanceArtifact.abi,
        "performProtectedAction", [], publicClient);
      assertEvent(protectedActionTx.receipt, governance, governanceArtifact.abi, "ProtectedActionPerformed");
      daoReceipts.protectedAction = receiptSummary(protectedActionTx);

      daoReceipts.revokePolicy4Credential = receiptSummary(await transact(
        issuerWallet, registry, credentialRegistryAbi, "revokeCredential", [borrower, governancePolicyId], publicClient,
      ));
      const revokedCredentialSnapshot = await readRobinhoodGovernanceSnapshot(publicClient, governance, registry, borrower);
      assert.equal(revokedCredentialSnapshot.state, "ready");
      assert.equal(revokedCredentialSnapshot.snapshot.isVerifiedMember, false, "Revoked project credential still granted DAO membership.");
      assert.equal(revokedCredentialSnapshot.snapshot.credentialState, "revoked", "DAO read adapter did not identify a revoked policy-4 record.");
      await rpc(rpcUrl, "evm_increaseTime", [11 * 24 * 60 * 60]);
      await rpc(rpcUrl, "evm_mine");
      const expiredCredentialSnapshot = await readRobinhoodGovernanceSnapshot(publicClient, governance, registry, daoVoter);
      assert.equal(expiredCredentialSnapshot.state, "ready");
      assert.equal(expiredCredentialSnapshot.snapshot.isVerifiedMember, false, "Expired project credential still granted DAO membership.");
      assert.equal(expiredCredentialSnapshot.snapshot.credentialState, "expired", "DAO read adapter did not identify an expired policy-4 record.");
      governanceEvidence = {
        result: "Robinhood-native DAO Phase 1 local lifecycle passed",
        chainId,
        credential: { issuer, policyId: governancePolicyId.toString(), membershipSource: "project-issued registry record" },
        proposal: {
          id: proposalId.toString(),
          finalState: "executed",
          forVotes: finalProposal.forVotes.toString(),
          action: "updated only minimumRemainingValidity on the DAO-owned protected action",
        },
        duplicateVoteRejected: true,
        preStartVoteRejected: true,
        proposalDiscovery: "empty page, proposal ID, lifecycle state, vote totals, and quorum read from local contract",
        credentialReadback: "active issuer-backed, revoked, and expired policy-4 states confirmed",
        receipts: daoReceipts,
      };
    }

    process.stdout.write(JSON.stringify({
      result: chainId === 46_630
        ? "Robinhood local Anvil DAO Phase 1 and Lending V2 lifecycles passed"
        : "LendingPoolV2 local Anvil lifecycle passed with real generated proof and on-chain verifier acceptance",
      chainId,
      environment: `isolated local Anvil chain ${chainId}; synthetic test prices; no Robinhood Testnet or GIWA Sepolia transactions`,
      addresses: { registry, generatedVerifier, verifierAdapter, testOracle, lendingAsset, collateralAsset, lendingPool },
      policy: { id: policyId.toString(), version: policyVersion.toString(), threshold: threshold.toString() },
      proof: {
        localVerification: "verified",
        onchainVerification: "accepted for supply, collateral activation, and borrow",
        publicInputCount: borrowerProof.publicInputCount,
        v2PoolBound: borrowerProof.publicInputs[8] === BigInt(lendingPool),
        issuerReadback: issuer,
        commitment: borrowerProof.commitment,
      },
      accrual: {
        borrowerDebtBefore: debtBeforeAccrual.toString(),
        borrowerDebtAfter30Days: debtAfterAccrual.toString(),
        supplierBalanceAfter30Days: supplierBalanceAfterAccrual.toString(),
        currentBorrowRateBps: rateData.currentBorrowRateBps.toString(),
      },
      liquidation: {
        healthFactorBefore: unhealthy.healthFactorWad.toString(),
        debtAfter: liquidationDebtAfter.toString(),
        collateralReceivedByLiquidator: seizedCollateral.toString(),
      },
      governance: governanceEvidence,
      typedAdapter: {
        reserveCount: initialMarket.reserves.length,
        riskPaused: initialMarket.riskPaused,
        staleOracleStates: staleMarket.reserves.map((reserve) => reserve.oracle.state),
        healthFactorWadBeforeLiquidation: unhealthyMarket.position.account.healthFactorWad.toString(),
        positionRefreshAfterFullRepay: repaidMarket.position.byAsset[lendingAsset.toLowerCase()].debt === 0n,
        positionRefreshAfterLiquidation: liquidatedMarket.position.byAsset[lendingAsset.toLowerCase()].debt < 900n * loanUnit,
      },
      lifecycleReceipts: receiptsForLifecycle,
      liquidationReceipts: receipts,
      externalBroadcast: false,
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
  const minimumLocalGasLimit = 10_000_000n;
  const estimatedGas = request.gas ?? 0n;
  const gas = estimatedGas * 2n > minimumLocalGasLimit ? estimatedGas * 2n : minimumLocalGasLimit;
  const hash = await wallet.writeContract({ ...request, gas });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    let traceSummary = "unavailable";
    try {
      const trace = await publicClient.request({
        method: "debug_traceTransaction",
        params: [hash, { tracer: "callTracer" }],
      });
      const summarizeCall = (call) => ({
        type: call.type,
        to: call.to,
        error: call.error,
        revertReason: call.revertReason,
        output: call.output,
        calls: call.calls?.map(summarizeCall),
      });
      traceSummary = JSON.stringify(summarizeCall(trace));
    } catch (error) {
      traceSummary = error instanceof Error ? error.message : String(error);
    }
    throw new Error(`${functionName} transaction ${hash} reverted: ${traceSummary}`);
  }
  return { hash, receipt };
}

function receiptSummary({ hash, receipt }) {
  return { hash, status: receipt.status, blockNumber: receipt.blockNumber.toString(), logCount: receipt.logs.length };
}

function assertEvent(receipt, address, abi, eventName) {
  const logs = parseEventLogs({ abi, address, logs: receipt.logs, strict: false });
  assert.ok(logs.some((event) => event.eventName === eventName), `Receipt did not include ${eventName}.`);
}

async function expectSimulationFailure(action, expectedPattern, message) {
  let failure;
  try {
    await action();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, message);
  const detail = describeError(failure);
  if (expectedPattern) assert.match(detail.toLowerCase(), expectedPattern, `${message} Actual error: ${detail}`);
}

function describeError(error, depth = 0) {
  if (depth > 5 || !error || typeof error !== "object") return String(error ?? "");
  const value = error;
  const data = value.data && typeof value.data === "object" ? value.data : {};
  const detail = [value.name, value.message, value.shortMessage, data.errorName, data.reason, describeError(value.cause, depth + 1)]
    .filter(Boolean).join(" ");
  const decodedNames = [
      "WrongPolicy()", "WrongLendingPool()", "CredentialExpired(address)", "StaleOraclePrice(address,uint64,uint64)",
      "VotingNotStarted()", "AlreadyVoted()",
  ].filter((signature) => detail.toLowerCase().includes(toFunctionSelector(signature).toLowerCase()))
    .map((signature) => signature.slice(0, signature.indexOf("(")));
  return `${detail} ${decodedNames.join(" ")}`;
}

function runFoundryDeploymentSimulation({ rpcUrl, admin, issuer, registry, verifierAdapter, generatedVerifier, chainId }) {
  const robinhood = chainId === 46_630;
  const baseEnv = {
    ...process.env,
    ...(robinhood ? {
      RH_TESTNET_ADMIN_ADDRESS: admin,
      RH_TESTNET_ISSUER_ADDRESS: issuer,
      RH_TESTNET_HONK_VERIFIER_ADDRESS: generatedVerifier,
    } : {
      GIWA_ADMIN_ADDRESS: admin,
      GIWA_ISSUER_ADDRESS: issuer,
      GIWA_CREDENTIAL_REGISTRY_ADDRESS: registry,
      GIWA_VERIFIER_ADAPTER_ADDRESS: verifierAdapter,
    }),
  };
  const simulate = (script, env) => {
    const result = spawnSync("bash", [
      "scripts/forge-simulate.sh",
      script,
      ...(robinhood ? ["--profile", "robinhood_testnet"] : []),
      "--rpc-url",
      rpcUrl,
    ], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env,
    });
    if (result.error) throw result.error;
    assert.equal(
      result.status,
      0,
      `Foundry local no-broadcast deployment simulation failed for ${script}:\n${result.stdout}\n${result.stderr}`,
    );
  };

  simulate(
    robinhood
      ? "script/DeployLendingV2RobinhoodTestnet.s.sol:DeployLendingV2RobinhoodTestnet"
      : "script/DeployLendingV2GIWASepolia.s.sol:DeployLendingV2GIWASepolia",
    baseEnv,
  );

  if (robinhood) {
    simulate("script/DeployRobinhoodProtocolStack.s.sol:DeployRobinhoodProtocolStack", {
      ...baseEnv,
      RH_TESTNET_GOVERNANCE_VOTING_PERIOD: "3600",
      RH_TESTNET_GOVERNANCE_QUORUM: "2",
      RH_TESTNET_GOVERNANCE_EXECUTION_WINDOW: String(7 * 24 * 60 * 60),
      RH_TESTNET_GOVERNANCE_INITIAL_MIN_VALIDITY: "0",
      RH_TESTNET_LENDING_TOKEN_MINT_CAP: String(1_000_000n * loanUnit),
      RH_TESTNET_COLLATERAL_TOKEN_MINT_CAP: String(1_000_000n * collateralUnit),
      RH_TESTNET_LENDING_SUPPLY_CAP: String(100_000n * loanUnit),
      RH_TESTNET_LENDING_BORROW_CAP: String(50_000n * loanUnit),
      RH_TESTNET_COLLATERAL_CAP: String(100_000n * collateralUnit),
      RH_TESTNET_MIN_BORROW_AMOUNT: String(loanUnit),
      RH_TESTNET_MAX_ORACLE_AGE: "3600",
      RH_TESTNET_MAX_LTV_BPS: "5000",
      RH_TESTNET_LIQUIDATION_THRESHOLD_BPS: "6500",
      RH_TESTNET_LIQUIDATION_BONUS_BPS: "500",
      RH_TESTNET_CLOSE_FACTOR_BPS: "5000",
      RH_TESTNET_RESERVE_FACTOR_BPS: "1000",
      RH_TESTNET_OPTIMAL_UTILIZATION_BPS: "8000",
      RH_TESTNET_BASE_BORROW_RATE_BPS: "200",
      RH_TESTNET_SLOPE1_BPS: "400",
      RH_TESTNET_SLOPE2_BPS: "6000",
      RH_TESTNET_LENDING_PRICE_MIN_WAD: "950000000000000000",
      RH_TESTNET_LENDING_PRICE_MAX_WAD: "1050000000000000000",
      RH_TESTNET_COLLATERAL_PRICE_MIN_WAD: "500000000000000000",
      RH_TESTNET_COLLATERAL_PRICE_MAX_WAD: "4000000000000000000",
    });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
