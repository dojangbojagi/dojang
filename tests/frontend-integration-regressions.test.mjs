import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { isExplicitEvmWalletProvider, hasExplicitEvmWalletProvider } from "../src/lib/wallet/provider-detection.ts";
import { parseValidity } from "../src/components/dao/format.ts";
import { parseAmount } from "../src/components/lending/format.ts";
import { robinhoodMainnetDemoContracts } from "../src/lib/config/robinhood-mainnet-demo.ts";

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
  expect(network).toContain("const target = supportedProtocolChains.find((chain) => chain.id === chainId)");
  expect(network).toContain("${connectorName} reported that ${target?.name ?? `chain ${chainId}`} is unsupported");
  expect(network).toContain("Choose a compatible EVM wallet such as MetaMask or Rabby");
});

test("the selected Robinhood network is shared by the header and Mainnet-capable product flows", async () => {
  const [header, picker, provider, selection, lending, dao, bojagi, credentials] = await Promise.all([
    readFile(new URL("../src/components/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/protocol-network-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/providers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/protocol-network-selection.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/lending-v2/lending-v2-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dao/dao-phase2-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/robinhood-bojagi-proof.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/robinhood-project-credential-status.tsx", import.meta.url), "utf8"),
  ]);
  expect(provider).toContain("<ProtocolNetworkSelectionProvider>");
  expect(selection).toContain("localStorage.setItem(STORAGE_KEY, String(chainId))");
  expect(header).toContain("<ProtocolNetworkPicker");
  expect(header).not.toMatch(/<select\b/i);
  expect(picker).toContain('full: "Robinhood Mainnet — 4663"');
  expect(picker).toContain('full: "Robinhood Testnet — 46630"');
  expect(lending).toContain("useProtocolNetworkSelection()");
  expect(dao).toContain("useProtocolNetworkSelection()");
  expect(bojagi).toContain("useLendingMarketV2(selectedChainId)");
  expect(credentials).toContain("Policy {isMainnet ? \"5\" : \"4\"}");
});

test("2 dUSD is parsed as exactly 2,000,000 base units and supply approval stays exact", async () => {
  expect(parseAmount("2", 6)).toEqual({ value: 2_000_000n, error: null });
  expect(parseAmount("2.000000", 6)).toEqual({ value: 2_000_000n, error: null });
  expect(parseAmount("2.0000001", 6).error).toContain("6 decimals");
  expect(robinhoodMainnetDemoContracts.loanToken).toBe("0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1");
  expect(robinhoodMainnetDemoContracts.lendingPool).toBe("0x8706B2fe815fB3C5986acE47b59bE0853567B48D");
  const [supply, action, lending] = await Promise.all([
    readFile(new URL("../src/components/lending-v2/v2-supply.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/lending-v2/reviewed-action.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/hooks/use-lending-market-v2.ts", import.meta.url), "utf8"),
  ]);
  expect(supply).toContain("submitPrecondition={!proofValue ?");
  expect(supply).toContain("Approval is limited to the amount entered");
  expect(supply).toContain("approvalPrecondition=");
  expect(supply).toContain("Generate Policy 3 Proof");
  expect(supply).toContain("Current pool allowance");
  expect(action).toContain("approvalStage = needsApproval && Boolean(onApprove)");
  expect(action).toContain("approvalPrecondition === undefined");
  expect(lending).toContain('functionName: "approve"');
  expect(lending).toContain("args: [pool, amount]");
  expect(lending).toContain("await assertBalance(asset, amount)");
  expect(lending).toContain("currentAllowance >= amount");
  expect(lending).toContain("return allowance >= amount");
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
  expect(v2Workspace).toContain("useWalletNetwork(chainId)");
  expect(v2Workspace).toContain("const { selectedChainId: chainId } = useProtocolNetworkSelection()");
});

test("DAO unit choices preserve their exact seconds conversion", () => {
  expect(parseValidity("1", "days").value).toBe(86_400n);
  expect(parseValidity("1", "hours").value).toBe(3_600n);
  expect(parseValidity("1", "minutes").value).toBe(60n);
  expect(parseValidity("1", "seconds").value).toBe(1n);
  expect(parseValidity("366", "days").error).toContain("365 days");
});

test("DAO defaults to the Robinhood project-credential route and does not follow the wallet into GIWA", async () => {
  const workspace = await readFile(new URL("../src/components/dao/dao-workspace.tsx", import.meta.url), "utf8");
  expect(workspace).toContain("useState<ProtocolChainId>(ROBINHOOD_TESTNET_CHAIN_ID)");
  expect(workspace).not.toContain("observedWallet.chainId");
  expect(workspace).toContain("GYEVO DAO · Robinhood Testnet");
  expect(workspace).toContain("Legacy GIWA Sepolia governance");
});

test("recording history is read-only and verifies receipts against project events", async () => {
  const [history, appHome, productCopy] = await Promise.all([
    readFile(new URL("../src/components/evidence/verified-demo-history.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/landing/sections.tsx", import.meta.url), "utf8"),
  ]);
  expect(appHome).toContain("Explore Verified Demo");
  expect(history).toContain("readRobinhoodTransactionEvidence(client, item.hash)");
  expect(history).toContain("receiptMatches(item, evidence)");
  expect(history).toContain("Current on-chain state");
  expect(history).toContain("These are historical actions, not current positions.");
  expect(history).not.toContain("window.ethereum");
  expect(productCopy).toContain("Policy 4 → DAO, or Policy 3 → BOJAGI → Lending");
  expect(productCopy).not.toContain("full public wallet journeys are still being confirmed");
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
