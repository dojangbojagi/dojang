import { describe, expect, test } from "bun:test";
import {
  assertCanonicalDeployment,
  parseDeploymentArtifact,
} from "../scripts/robinhood-mainnet-dao2-status.mjs";

const deployer = "0x49332447f1f4e14a0d671bb988d9822465fbc28b";
const other = "0x1111111111111111111111111111111111111111";
const entries = [
  ["RobinhoodMainnetDemoLendingReputation", "0x0329f0c47a7e2d390b0593fe3f3348b4c467158c", "0x117900470f19628ee4ba64394eae95ab5cd958fe4cfa6924f1b3dc4e33c9ef3a"],
  ["RobinhoodMainnetDemoGovernancePhase2", "0x0d543953a62a932ca687b160a59b8950af52c252", "0x757f72740efa0cc7efb4d44d1b734f175a973d592495de1f8eb6e80d864c45c2"],
];
const blockHash = `0x${"ab".repeat(32)}`;

function artifactWithSender(from = null) {
  return {
    chain: 4663,
    transactions: entries.map(([contractName, contractAddress, hash]) => ({
      transactionType: "CREATE", contractName, contractAddress, hash, from,
    })),
    receipts: entries.map(([, contractAddress, transactionHash], index) => ({
      transactionHash,
      status: "0x1",
      contractAddress,
      blockNumber: `0x${(index + 100).toString(16)}`,
      blockHash,
    })),
  };
}

function liveEvidence(item, from = deployer) {
  return {
    transaction: { from, to: null, chainId: 4663, blockHash },
    receipt: {
      transactionHash: item.hash,
      status: "success",
      contractAddress: item.address,
      blockNumber: item.blockNumber,
      blockHash,
    },
  };
}

describe("Robinhood Mainnet DAO Phase 2 deployment sender verification", () => {
  test("accepts a null Foundry artifact sender only when canonical RPC sender matches deployer", () => {
    const deployment = parseDeploymentArtifact(artifactWithSender(null), deployer);
    const item = deployment.RobinhoodMainnetDemoLendingReputation;
    expect(item.artifactFrom).toBeUndefined();
    const evidence = liveEvidence(item);
    expect(assertCanonicalDeployment({
      name: "RobinhoodMainnetDemoLendingReputation", item, ...evidence, deployer,
    })).toBe(true);
  });

  test("rejects an RPC transaction sent by an address other than the configured deployer", () => {
    const deployment = parseDeploymentArtifact(artifactWithSender(null), deployer);
    const item = deployment.RobinhoodMainnetDemoGovernancePhase2;
    const evidence = liveEvidence(item, other);
    expect(() => assertCanonicalDeployment({
      name: "RobinhoodMainnetDemoGovernancePhase2", item, ...evidence, deployer,
    })).toThrow("canonical RPC sender differs from the configured Mainnet deployer");
  });

  test("rejects a recorded artifact sender that conflicts with configured deployer", () => {
    expect(() => parseDeploymentArtifact(artifactWithSender(other), deployer))
      .toThrow("artifact sender differs from the configured Mainnet deployer");
  });
});
