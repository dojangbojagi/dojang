import { describe, expect, test } from "bun:test";
import { checkPhase2Deployment } from "../src/lib/governance/phase2-service.ts";

const addresses = {
  governance: "0x0000000000000000000000000000000000000001",
  reputationRegistry: "0x0000000000000000000000000000000000000002",
  credentialRegistry: "0x0000000000000000000000000000000000000003",
  verifier: "0x0000000000000000000000000000000000000004",
  lendingPool: "0x0000000000000000000000000000000000000005",
};

function makeClient(chainId) {
  const bytecodeAddresses = [];
  const contractReads = [];
  const client = {
    async getChainId() { return chainId; },
    async getBytecode({ address }) {
      bytecodeAddresses.push(address);
      return "0x6000";
    },
    async readContract({ functionName }) {
      contractReads.push(functionName);
      if (functionName === "credentialRegistry") return addresses.credentialRegistry;
      if (functionName === "reputationRegistry") return addresses.reputationRegistry;
      if (functionName === "eligibilityVerifier") return addresses.verifier;
      if (functionName === "lendingPool") return addresses.lendingPool;
      if (functionName === "demoOnly") return true;
      throw new Error(`Unexpected Phase 2 read: ${functionName}`);
    },
  };
  return { client, bytecodeAddresses, contractReads };
}

describe("DAO Phase 2 deployment reads", () => {
  test("checks only the five configured Testnet contract addresses", async () => {
    const configured = { ...addresses, chainId: 46_630 };
    const reads = makeClient(46_630);
    await expect(checkPhase2Deployment(reads.client, configured)).resolves.toBe("ready");
    expect(reads.bytecodeAddresses).toEqual(Object.values(addresses));
  });

  test("checks only the five Mainnet addresses and confirms demo-only dependencies", async () => {
    const configured = { ...addresses, chainId: 4_663 };
    const reads = makeClient(4_663);
    await expect(checkPhase2Deployment(reads.client, configured)).resolves.toBe("ready");
    expect(reads.bytecodeAddresses).toEqual(Object.values(addresses));
    expect(reads.contractReads.filter((name) => name === "demoOnly")).toHaveLength(4);
  });

  test("rejects address sets assigned to a different chain before RPC access", async () => {
    const configured = { ...addresses, chainId: 46_630 };
    let rpcReads = 0;
    const client = {
      async getChainId() { rpcReads += 1; return 46_630; },
    };
    await expect(checkPhase2Deployment(client, configured, 4_663)).rejects.toThrow(
      "Phase 2 addresses are configured for chain 46630; expected 4663.",
    );
    expect(rpcReads).toBe(0);
  });
});
