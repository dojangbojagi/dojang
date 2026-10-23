import { describe, expect, test } from "bun:test";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";

const witness = {
  format: "gyevo-credential-v1",
  chainId: 46_630,
  wallet: "0x00000000000000000000000000000000000000a1",
  policyId: 3,
  commitment: `0x${"11".repeat(32)}`,
  privateValue: "1200",
  salt: `0x${"22".repeat(32)}`,
  expiresAt: 1_900_000_000,
};

describe("GYEVO credential JSON compatibility", () => {
  test("parses the GYEVO format without changing private or committed witness fields", () => {
    expect(parseDemoCredentialWitness(witness)).toEqual(witness);
  });

  test("continues to import both existing network-specific credential formats", () => {
    const { chainId: _chainId, ...legacyFields } = witness;
    expect(parseDemoCredentialWitness({ ...legacyFields, format: "robinhood-demo-credential-v1" })).toEqual({
      ...legacyFields,
      format: "robinhood-demo-credential-v1",
    });
    expect(parseDemoCredentialWitness({ ...legacyFields, format: "giwa-demo-credential-v1" })).toEqual({
      ...legacyFields,
      format: "giwa-demo-credential-v1",
    });
  });

  test("requires chain metadata for new GYEVO credentials", () => {
    const { chainId: _chainId, ...withoutChain } = witness;
    expect(() => parseDemoCredentialWitness(withoutChain)).toThrow();
  });

  test("rejects unsupported formats and invalid wallet, policy, and cryptographic fields", () => {
    expect(() => parseDemoCredentialWitness({ ...witness, format: "untrusted-format" })).toThrow();
    expect(() => parseDemoCredentialWitness({ ...witness, wallet: "not-an-address" })).toThrow();
    expect(() => parseDemoCredentialWitness({ ...witness, policyId: 0 })).toThrow();
    expect(() => parseDemoCredentialWitness({ ...witness, commitment: "0x12" })).toThrow();
    expect(() => parseDemoCredentialWitness({ ...witness, privateValue: "1.25" })).toThrow();
    expect(() => parseDemoCredentialWitness({ ...witness, salt: "not-a-salt" })).toThrow();
  });

  test("creates GYEVO metadata while preserving every cryptographic witness value", async () => {
    const credential = await import("../src/lib/credential/witness.ts");
    const { format: _format, chainId: _chainId, ...payload } = witness;
    expect(typeof credential.createGyevoCredentialWitness).toBe("function");
    expect(credential.createGyevoCredentialWitness(payload, 46_630)).toEqual(witness);
  });

  test("keeps GYEVO chain binding and legacy network-family compatibility explicit", async () => {
    const credential = await import("../src/lib/credential/witness.ts");
    expect(typeof credential.isCredentialWitnessForChain).toBe("function");
    expect(credential.isCredentialWitnessForChain(witness, 46_630, "robinhood-demo-credential-v1")).toBe(true);
    expect(credential.isCredentialWitnessForChain(witness, 4_663, "robinhood-demo-credential-v1")).toBe(false);
    expect(credential.isCredentialWitnessForChain({ ...witness, format: "robinhood-demo-credential-v1", chainId: undefined }, 4_663, "robinhood-demo-credential-v1")).toBe(true);
    expect(credential.isCredentialWitnessForChain({ ...witness, format: "giwa-demo-credential-v1", chainId: undefined }, 91_342, "giwa-demo-credential-v1")).toBe(true);
    expect(credential.isCredentialWitnessForChain({ ...witness, format: "giwa-demo-credential-v1", chainId: undefined }, 46_630, "robinhood-demo-credential-v1")).toBe(false);
  });

  test("creates a UI-safe credential summary without secret or full-address fields", async () => {
    const credential = await import("../src/lib/credential/witness.ts");
    expect(typeof credential.summarizeCredentialWitness).toBe("function");
    const summary = credential.summarizeCredentialWitness(witness, "Robinhood Chain Testnet", true);
    expect(summary).toEqual({
      policyId: 3,
      chainId: 46_630,
      networkName: "Robinhood Chain Testnet",
      expiresAt: 1_900_000_000,
      walletAssociation: "matches-connected-wallet",
    });
    expect(summary).not.toHaveProperty("wallet");
    expect(summary).not.toHaveProperty("commitment");
    expect(summary).not.toHaveProperty("privateValue");
    expect(summary).not.toHaveProperty("salt");
    expect(credential.summarizeCredentialWitness(witness, "Robinhood Chain Testnet", false).walletAssociation).toBe("does-not-match-connected-wallet");
  });

  test("uses policy-specific GYEVO credential filenames", async () => {
    const credential = await import("../src/lib/credential/witness.ts");
    expect(typeof credential.credentialDownloadFilename).toBe("function");
    expect(credential.credentialDownloadFilename(3)).toBe("gyevo-policy3-credential.json");
    expect(credential.credentialDownloadFilename(4)).toBe("gyevo-policy4-credential.json");
    expect(credential.credentialDownloadFilename(5)).toBe("gyevo-policy5-credential.json");
    expect(() => credential.credentialDownloadFilename(0)).toThrow();
  });

  test("bounds credential JSON imports and rejects malformed JSON without echoing secret contents", async () => {
    const credential = await import("../src/lib/credential/witness.ts");
    expect(typeof credential.parseCredentialWitnessJson).toBe("function");
    expect(credential.parseCredentialWitnessJson(JSON.stringify(witness))).toEqual(witness);
    expect(() => credential.parseCredentialWitnessJson("{not json" )).toThrow("Credential file must contain valid JSON.");
    expect(() => credential.parseCredentialWitnessJson(" ".repeat(262_145))).toThrow("Credential file exceeds the 256 KB import limit.");
  });
});
