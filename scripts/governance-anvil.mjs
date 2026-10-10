import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEventLogs,
  toHex,
} from "viem";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsRoot = path.resolve(root, "contracts/out");
const chain = defineChain({
  id: 91_342,
  name: "GIWA Governance Local Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
});
const attesterId = "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034";
const verifiedAddressSchemaUid = "0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08";

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
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", [
    "--silent", "--host", "127.0.0.1", "--port", String(port), "--chain-id", "91342",
    "--accounts", "8", "--gas-limit", "100000000",
  ], { stdio: "ignore" });
  let receipts = [];

  try {
    const localChain = { ...chain, rpcUrls: { default: { http: [rpcUrl] } } };
    const publicClient = createPublicClient({ chain: localChain, transport: http(rpcUrl) });
    for (let attempt = 0; attempt < 80; attempt++) {
      if (anvil.exitCode !== null) throw new Error(`Anvil exited with status ${anvil.exitCode}.`);
      try {
        if (await publicClient.getChainId() === 91_342) break;
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
    assert.ok(accounts.length >= 5, "Anvil should expose local test accounts.");
    const [deployer, proposer, voterTwo, ineligible, trustedAttester] = accounts;
    const walletFor = (account) => createWalletClient({ account, chain: localChain, transport: http(rpcUrl) });
    const deployerWallet = walletFor(deployer);
    const proposerWallet = walletFor(proposer);
    const voterTwoWallet = walletFor(voterTwo);

    async function send(wallet, request, label) {
      const hash = await wallet.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", `${label} transaction reverted.`);
      receipts.push({
        step: label,
        hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
      });
      return receipt;
    }

    async function deploy(relativePath, args = []) {
      const artifact = await loadArtifact(relativePath);
      const hash = await deployerWallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", `${relativePath} deployment reverted.`);
      assert.ok(receipt.contractAddress, `${relativePath} has no deployed address.`);
      receipts.push({
        step: `deploy:${relativePath}`,
        hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
      });
      return receipt.contractAddress;
    }

    const dojangArtifact = await loadArtifact("Governance.t.sol/DojangScrollFixture.json");
    const attesterBookArtifact = await loadArtifact("Governance.t.sol/DojangAttesterBookFixture.json");
    const easArtifact = await loadArtifact("Governance.t.sol/EASDojangFixture.json");
    const governanceArtifact = await loadArtifact("GovernedDojangAccess.sol/GovernedDojangAccess.json");
    const dojangScroll = await deploy("Governance.t.sol/DojangScrollFixture.json");
    const attesterBook = await deploy("Governance.t.sol/DojangAttesterBookFixture.json");
    const eas = await deploy("Governance.t.sol/EASDojangFixture.json");
    const trustedAttesterId = attesterId;
    const bookFixture = { address: attesterBook, abi: attesterBookArtifact.abi };
    const dojangFixture = { address: dojangScroll, abi: dojangArtifact.abi };
    const easFixture = { address: eas, abi: easArtifact.abi };
    const governanceAbi = governanceArtifact.abi;

    await send(deployerWallet, {
      ...bookFixture,
      functionName: "setAttester",
      args: [trustedAttesterId, trustedAttester],
    }, "fixture:setTrustedAttester");

    const latestBlock = await publicClient.getBlock();
    const issuedAt = latestBlock.timestamp;
    const expiresAt = issuedAt + 30n * 24n * 60n * 60n;
    const memberUids = new Map([[proposer, toHex(1n, { size: 32 })], [voterTwo, toHex(2n, { size: 32 })]]);
    for (const [wallet, uid] of memberUids) {
      await send(deployerWallet, {
        ...dojangFixture,
        functionName: "setCredential",
        args: [wallet, uid, true],
      }, `fixture:setDojang:${wallet}`);
      await send(deployerWallet, {
        ...easFixture,
        functionName: "setVerifiedAddress",
        args: [wallet, uid, verifiedAddressSchemaUid, issuedAt, expiresAt, trustedAttester, true],
      }, `fixture:setEas:${wallet}`);
    }

    const governance = await deploy("GovernedDojangAccess.sol/GovernedDojangAccess.json", [
      dojangScroll,
      attesterBook,
      eas,
      attesterId,
      verifiedAddressSchemaUid,
      60n,
      2n,
      7n * 24n * 60n * 60n,
      0n,
    ]);
    const isVerifiedMember = (wallet) => publicClient.readContract({
      address: governance,
      abi: governanceAbi,
      functionName: "isVerifiedMember",
      args: [wallet],
    });
    assert.equal(await isVerifiedMember(proposer), true, "eligible proposer was not verified");
    assert.equal(await isVerifiedMember(ineligible), false, "ineligible wallet was accepted");

    const createProposalCall = {
      address: governance,
      abi: governanceAbi,
      functionName: "createProposal",
      args: ["ipfs://local-governance-policy", 2n * 24n * 60n * 60n],
    };
    await assert.rejects(
      publicClient.simulateContract({ ...createProposalCall, account: ineligible }),
      "unverified proposal creation unexpectedly succeeded",
    );
    const createReceipt = await send(proposerWallet, createProposalCall, "proposal:create");
    const proposalEvents = parseEventLogs({ abi: governanceAbi, logs: createReceipt.logs, eventName: "ProposalCreated" });
    assert.equal(proposalEvents.length, 1, "ProposalCreated event was not emitted");
    const proposalId = proposalEvents[0].args.proposalId;
    const pendingState = await publicClient.readContract({
      address: governance,
      abi: governanceAbi,
      functionName: "proposalState",
      args: [proposalId],
    });
    assert.equal(pendingState, 1, "proposal did not begin Pending");
    await assert.rejects(
      publicClient.simulateContract({
        address: governance,
        abi: governanceAbi,
        functionName: "castVote",
        args: [proposalId, 1],
        account: proposer,
      }),
      "vote before start unexpectedly succeeded",
    );

    await publicClient.request({ method: "evm_increaseTime", params: [61] });
    await publicClient.request({ method: "evm_mine", params: [] });
    const voteReceiptOne = await send(proposerWallet, {
      address: governance,
      abi: governanceAbi,
      functionName: "castVote",
      args: [proposalId, 1],
    }, "vote:for:proposer");
    await assert.rejects(
      publicClient.simulateContract({
        address: governance,
        abi: governanceAbi,
        functionName: "castVote",
        args: [proposalId, 2],
        account: proposer,
      }),
      "duplicate wallet vote unexpectedly succeeded",
    );
    await assert.rejects(
      publicClient.simulateContract({
        address: governance,
        abi: governanceAbi,
        functionName: "castVote",
        args: [proposalId, 1],
        account: ineligible,
      }),
      "unverified wallet vote unexpectedly succeeded",
    );
    const voteReceiptTwo = await send(voterTwoWallet, {
      address: governance,
      abi: governanceAbi,
      functionName: "castVote",
      args: [proposalId, 1],
    }, "vote:for:voter-two");
    assert.ok(voteReceiptOne.blockNumber < voteReceiptTwo.blockNumber, "votes were not mined separately");

    await publicClient.request({ method: "evm_increaseTime", params: [61] });
    await publicClient.request({ method: "evm_mine", params: [] });
    await assert.rejects(
      publicClient.simulateContract({
        address: governance,
        abi: governanceAbi,
        functionName: "castVote",
        args: [proposalId, 1],
        account: ineligible,
      }),
      "vote after deadline unexpectedly succeeded",
    );
    await send(deployerWallet, {
      address: governance,
      abi: governanceAbi,
      functionName: "finalizeProposal",
      args: [proposalId],
    }, "proposal:finalize");
    assert.equal(await publicClient.readContract({
      address: governance,
      abi: governanceAbi,
      functionName: "proposalState",
      args: [proposalId],
    }), 3, "proposal did not reach Succeeded state");

    const actionBefore = await publicClient.readContract({
      address: governance,
      abi: governanceAbi,
      functionName: "protectedActionCount",
      args: [proposer],
    });
    const beforeReceipt = await send(proposerWallet, {
      address: governance,
      abi: governanceAbi,
      functionName: "performProtectedAction",
    }, "protected-action:before-policy-change");
    assert.ok(beforeReceipt.gasUsed > 0n, "protected action did not consume gas");
    const currentActionCount = await publicClient.readContract({
      address: governance,
      abi: governanceAbi,
      functionName: "protectedActionCount",
      args: [proposer],
    });
    assert.equal(currentActionCount, actionBefore + 1n, "protected action did not change on-chain state");

    await send(deployerWallet, {
      address: governance,
      abi: governanceAbi,
      functionName: "executeProposal",
      args: [proposalId],
    }, "proposal:execute");
    const currentPolicy = await publicClient.readContract({
      address: governance,
      abi: governanceAbi,
      functionName: "minimumRemainingValidity",
    });
    assert.equal(currentPolicy, 2n * 24n * 60n * 60n, "approved policy value was not stored");
    await assert.rejects(
      publicClient.simulateContract({
        address: governance,
        abi: governanceAbi,
        functionName: "performProtectedAction",
        account: proposer,
      }),
      "protected action ignored the newly governed minimum validity",
    );
    assert.equal(await publicClient.readContract({
      address: governance,
      abi: governanceAbi,
      functionName: "protectedActionCount",
      args: [proposer],
    }), currentActionCount, "blocked protected action changed state");
    process.stdout.write(JSON.stringify({
      result: "local Anvil Dojang-gated governance lifecycle passed",
      chainId: 91_342,
      localOnly: true,
      contracts: { governance, dojangScroll, attesterBook, eas },
      proposalId: proposalId.toString(),
      membership: { eligible: true, unverified: false },
      outcome: { state: "executed", minimumRemainingValidity: currentPolicy.toString() },
      protectedAction: { beforeCount: actionBefore.toString(), afterCount: currentActionCount.toString(), blockedAfterPolicyChange: true },
      receipts,
    }, null, 2) + "\n");
  } finally {
    anvil.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
