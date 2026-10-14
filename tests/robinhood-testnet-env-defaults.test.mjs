import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

const registry = {
  zkTranscriptLib: "0xa8e694A6449237a6deE4EC3847D11c2d9b484B21",
  relationsLib: "0xfa7674DEFbE554477176628AD8aB36Fe5d8b83E5",
  honkVerifier: "0xEEB12913D55bfFd1DE762BDe4250c5f0B0072D61",
  credentialRegistry: "0x997F3415e83fFc37c29D142fF6f1c6D624E3D3a5",
  verifierAdapter: "0x069C8C36a426Be42fC227aD5eEc7c6772BFA191b",
  lendingV2Oracle: "0xEd60bF3276c4d520cBF81FA480435817EAD6c1E1",
  lendingV2Asset: "0x1b52f1F2BA6CF870415e207861C6f33DD3d5Ea0F",
  lendingV2Collateral: "0xB5c97153Dca052636eD692A9e17A9698Ca70160C",
  lendingV2Pool: "0x3FA7bdC06E4f3134E271ff9046561A6667b1718e",
  governance: "0x011EDe60AB460AF00E082e2086D0745B6a1B23D0",
};

describe("Robinhood production registry defaults", () => {
  test("resolves the confirmed Testnet registry when NEXT_PUBLIC address variables are absent", () => {
    const keys = [
      "NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_ZK_TRANSCRIPT_LIB_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_RELATIONS_LIB_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_HONK_VERIFIER_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_VERIFIER_ADAPTER_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ORACLE_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ASSET_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_COLLATERAL_CONTRACT",
      "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT",
    ];
    const script = `
      for (const key of ${JSON.stringify(keys)}) delete process.env[key];
      const { appEnv } = await import("./src/lib/config/env.ts");
      process.stdout.write(JSON.stringify(appEnv.robinhoodContracts));
    `;
    const result = spawnSync(process.execPath, ["-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(registry);
  });
});
