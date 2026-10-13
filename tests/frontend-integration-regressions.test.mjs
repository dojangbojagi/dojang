import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { isExplicitEvmWalletProvider, hasExplicitEvmWalletProvider } from "../src/lib/wallet/provider-detection.ts";
import { parseValidity } from "../src/components/dao/format.ts";

test("explicit wallet detection does not mistake Phantom or Rabby for MetaMask", () => {
  expect(isExplicitEvmWalletProvider("metaMask", { isMetaMask: true })).toBe(true);
  expect(isExplicitEvmWalletProvider("metaMask", { isMetaMask: true, isPhantom: true })).toBe(false);
  expect(isExplicitEvmWalletProvider("metaMask", { isMetaMask: true, isRabby: true })).toBe(false);
  expect(isExplicitEvmWalletProvider("rabby", { isMetaMask: true, isRabby: true })).toBe(true);
  expect(hasExplicitEvmWalletProvider("rabby", { providers: [{ isPhantom: true }, { isRabby: true }] })).toBe(true);
  expect(hasExplicitEvmWalletProvider("metaMask", { providers: [{ isMetaMask: true, isPhantom: true }] })).toBe(false);
});

test("wallet choices detect installed identities and explain Phantom's unsupported Robinhood chain", async () => {
  const [providers, network] = await Promise.all([
    readFile(new URL("../src/components/providers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/hooks/use-wallet-network.ts", import.meta.url), "utf8"),
  ]);
  expect(providers).toContain("installed: typeof window !== \"undefined\" && hasExplicitEvmWalletProvider");
  expect(providers).toContain("injected({ shimDisconnect: true, target })");
  expect(providers).not.toMatch(/window\.ethereum\s*=/);
  expect(network).toContain("Phantom reported that Robinhood Testnet (chain 46630) is unsupported");
  expect(network).toContain("Choose MetaMask or Rabby");
});

test("primary Lending route only mounts Robinhood V2 and isolates legacy GIWA V1", async () => {
  const [experience, legacyRoute, v2Workspace] = await Promise.all([
    readFile(new URL("../src/components/lending-v2/lending-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/lending/legacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/lending-v2/lending-v2-workspace.tsx", import.meta.url), "utf8"),
  ]);
  expect(experience).toContain("<LendingV2Workspace />");
  expect(experience).not.toContain("<LendingWorkspace />");
  expect(experience).toContain("/lending/legacy");
  expect(legacyRoute).toContain("<LendingWorkspace />");
  expect(v2Workspace).toContain("useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID)");
});

test("DAO unit choices preserve their exact seconds conversion", () => {
  expect(parseValidity("1", "days").value).toBe(86_400n);
  expect(parseValidity("1", "hours").value).toBe(3_600n);
  expect(parseValidity("1", "minutes").value).toBe(60n);
  expect(parseValidity("1", "seconds").value).toBe(1n);
  expect(parseValidity("366", "days").error).toContain("365 days");
});

test("DAO selector keeps all four options and keyboard/outside-dismiss handling", async () => {
  const [selector, form] = await Promise.all([
    readFile(new URL("../src/components/dao/validity-unit-select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dao/create-proposal.tsx", import.meta.url), "utf8"),
  ]);
  for (const unit of ["days", "hours", "minutes", "seconds"]) expect(selector).toContain(`value: "${unit}"`);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Tab"]) expect(selector).toContain(`event.key === "${key}"`);
  expect(selector).toContain("document.addEventListener(\"pointerdown\", closeOutside)");
  expect(form).toContain("<ValidityUnitSelect");
  expect(form).not.toContain("<select");
});

test("legacy and V2 Lending share the premium upload surface without sharing parsers", async () => {
  const [legacy, v2, uploader] = await Promise.all([
    readFile(new URL("../src/components/lending/borrow-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/lending-v2/v2-eligibility.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/lending-v2/v2-witness-upload.tsx", import.meta.url), "utf8"),
  ]);
  expect(legacy).toContain("import { WitnessUpload }");
  expect(legacy).toContain("candidate.policyId !== Number(LENDING_POLICY_ID)");
  expect(v2).toContain("import { WitnessUpload }");
  expect(v2).toContain("candidate.policyId !== Number(LENDING_V2_POLICY_ID)");
  expect(uploader).toContain("status === \"loading\"");
  expect(uploader).toContain("MAX_BYTES = 256 * 1024");
  expect(uploader).toContain("onRejected?.(file, reason)");
});
