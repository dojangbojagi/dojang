import { describe, expect, test } from "bun:test";
import {
  assertActiveCredential,
  assertParticipantAddress,
  assertPositiveBaseUnits,
  assertPrivateWitnessFile,
  assertWitnessForParticipant,
  gasLimitWithHeadroom,
  LENDING_USER_ALIASES,
  LENDING_USER_AUTH,
  parseParticipantLabel,
  repaymentAllowanceRequired,
  requireActionAuthorization,
  transactionConfirmationPhrase,
} from "../scripts/robinhood-mainnet-lending-user-core.mjs";

const WALLET_A = "0x3cdb91a29b73daB9219D9A287543800B417b6dbB";
const WALLET_B = "0xc70865Ec508E6A1C55E6a3E6aB60533ef57286b8";

describe("Robinhood Mainnet encrypted participant Lending guards", () => {
  test("only the two configured participant labels and addresses are accepted", () => {
    expect(parseParticipantLabel("A")).toBe("A");
    expect(parseParticipantLabel("B")).toBe("B");
    expect(() => parseParticipantLabel("C")).toThrow();
    expect(assertParticipantAddress("A", WALLET_A, WALLET_A)).toBe(WALLET_A);
    expect(() => assertParticipantAddress("A", WALLET_B, WALLET_A)).toThrow();
    expect(LENDING_USER_ALIASES).toEqual({ A: null, B: "gyevo-rh-mainnet-wallet-b" });
  });

  test("Policy 3 witness must be Robinhood-specific and bound to the selected wallet", () => {
    const witness = {
      format: "robinhood-demo-credential-v1",
      wallet: WALLET_A,
      policyId: 3,
      commitment: `0x${"11".repeat(32)}`,
      privateValue: "1000",
      salt: `0x${"22".repeat(32)}`,
      expiresAt: 1_800_000_000,
    };
    expect(assertWitnessForParticipant(witness, WALLET_A)).toBe(witness);
    expect(() => assertWitnessForParticipant(witness, WALLET_B)).toThrow();
    expect(() => assertWitnessForParticipant({ ...witness, policyId: 5 }, WALLET_A)).toThrow();
    expect(() => assertWitnessForParticipant({ ...witness, format: "giwa-demo-credential-v1" }, WALLET_A)).toThrow();
  });

  test("accepts GYEVO Policy 3 only when its explicit chain metadata targets Mainnet", () => {
    const witness = {
      format: "gyevo-credential-v1",
      chainId: 4_663,
      wallet: WALLET_A,
      policyId: 3,
      commitment: `0x${"11".repeat(32)}`,
      privateValue: "1000",
      salt: `0x${"22".repeat(32)}`,
      expiresAt: 1_800_000_000,
    };
    expect(assertWitnessForParticipant(witness, WALLET_A)).toBe(witness);
    expect(() => assertWitnessForParticipant({ ...witness, chainId: 46_630 }, WALLET_A)).toThrow();
  });

  test("active credential checks include wallet, issuer, time validity, and revocation", () => {
    const record = { wallet: WALLET_A, issuer: WALLET_B, issuedAt: 100n, expiresAt: 500n, revoked: false };
    expect(assertActiveCredential(record, WALLET_A, 200n)).toBe(record);
    expect(() => assertActiveCredential(record, WALLET_B, 200n)).toThrow();
    expect(() => assertActiveCredential({ ...record, revoked: true }, WALLET_A, 200n)).toThrow();
    expect(() => assertActiveCredential(record, WALLET_A, 500n)).toThrow();
  });

  test("amounts are positive integer base units and write authorization is operation-specific", () => {
    expect(assertPositiveBaseUnits("2000000")).toBe(2_000_000n);
    expect(() => assertPositiveBaseUnits("2.0")).toThrow();
    expect(() => assertPositiveBaseUnits("0")).toThrow();
    for (const [action, authorization] of Object.entries(LENDING_USER_AUTH)) {
      expect(requireActionAuthorization(action, authorization)).toBe(authorization);
      expect(() => requireActionAuthorization(action, "wrong-label")).toThrow();
    }
    expect(transactionConfirmationPhrase("borrow", WALLET_A)).toBe(`EXECUTE Robinhood Mainnet Lending borrow ${WALLET_A}`);
  });

  test("witness permissions, gas headroom, and bounded repay margin are enforced", () => {
    expect(() => assertPrivateWitnessFile({ isFile: true, isSymbolicLink: false, mode: 0o100644, size: 200 })).toThrow();
    expect(() => assertPrivateWitnessFile({ isFile: true, isSymbolicLink: true, mode: 0o100600, size: 200 })).toThrow();
    expect(() => assertPrivateWitnessFile({ isFile: true, isSymbolicLink: false, mode: 0o100600, size: 20_000 })).toThrow();
    expect(assertPrivateWitnessFile({ isFile: true, isSymbolicLink: false, mode: 0o100600, size: 200 })).toBeUndefined();
    expect(gasLimitWithHeadroom(100_000n)).toBe(120_000n);
    expect(repaymentAllowanceRequired(1_000_000n, 500n)).toBeGreaterThan(1_000_000n);
    expect(repaymentAllowanceRequired(1_000_000n, 500n)).toBeLessThan(1_000_100n);
  });
});
