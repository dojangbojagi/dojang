import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const bundleDirectory = mkdtempSync(join(tmpdir(), "gyevo-lending-approval-"));
const bundlePath = join(bundleDirectory, "harness.js");
execFileSync("bun", ["build", "tests/browser/lending-approval-harness.tsx", "--target=browser", "--outfile", bundlePath], {
  cwd: process.cwd(),
  stdio: "pipe",
});

test("Mainnet dUSD approval is independent from proof and exact for Wallet A", async ({ page }) => {
  await page.setContent('<main><div id="root"></div></main>');
  await page.evaluate(() => { (window as Window & { process?: { env: Record<string, string> } }).process = { env: {} }; });
  await page.addScriptTag({ path: bundlePath });
  await expect(page.getByText("Test fixture: connected wallet mock on Robinhood Mainnet 4663. No wallet or RPC writes are available.")).toBeVisible();
  const supplyAction = page.locator(".lendv2-action").first();
  await supplyAction.getByLabel("Amount to supply").fill("2");

  const approve = supplyAction.getByRole("button", { name: "Approve 2 dUSD" });
  await expect(approve).toBeEnabled();
  await expect(supplyAction.getByText(/Approval is limited to the amount entered/)).toBeVisible();
  await approve.click();

  const request = await page.evaluate(() => (window as Window & { __approvalRequest?: unknown }).__approvalRequest);
  expect(request).toEqual({
    token: "0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1",
    spender: "0x8706B2fe815fB3C5986acE47b59bE0853567B48D",
    amount: "2000000",
  });
  expect(await page.evaluate(() => (window as Window & { __supplyCalled?: boolean }).__supplyCalled)).toBeUndefined();

  // Simulate only the post-approval allowance readback; this does not sign or create a transaction.
  await page.evaluate(() => (window as Window & { __setApprovalAllowance?: (value: string) => void }).__setApprovalAllowance?.("2000000"));
  await expect(supplyAction.getByRole("button", { name: "Confirm supply" })).toBeDisabled();
  await expect(supplyAction.getByText(/Generate a locally verified Policy 3 proof/)).toBeVisible();
  const proofStep = supplyAction.getByRole("link", { name: "Go to the Eligibility card to generate a Policy 3 proof" });
  await expect(proofStep).toHaveAttribute("href", "#lendv2-eligibility");
  await proofStep.click();
  await expect(page.getByRole("region", { name: "Eligibility" })).toBeInViewport();

  await page.evaluate(() => (window as Window & { __setProofReady?: (value: boolean) => void }).__setProofReady?.(true));
  await expect(supplyAction.getByRole("button", { name: "Confirm supply" })).toBeEnabled();
  expect(await page.evaluate(() => (window as Window & { __supplyCalled?: boolean }).__supplyCalled)).toBeUndefined();
});

test("approval gate blocks wrong chain, disconnected signer, insufficient fee balance, and insufficient token balance", async ({ page }) => {
  await page.setContent('<main><div id="root"></div></main>');
  await page.evaluate(() => { (window as Window & { process?: { env: Record<string, string> } }).process = { env: {} }; });
  await page.addScriptTag({ path: bundlePath });
  const supplyAction = page.locator(".lendv2-action").first();
  await supplyAction.getByLabel("Amount to supply").fill("2");
  const approve = supplyAction.getByRole("button", { name: "Approve 2 dUSD" });
  await expect(approve).toBeEnabled();

  const cases = [
    [{ chainId: 91342 }, "Switch to Robinhood Chain Mainnet (chain 4663) first."],
    [{ connected: false }, "Connect a wallet first."],
    [{ feeEstimateCovered: false }, "does not have enough ETH for the estimated fee"],
    [{ tokenBalance: 1_000_000n }, "more than the dUSD in your wallet"],
  ] as const;
  for (const [mockWallet, message] of cases) {
    await page.evaluate((state) => (window as Window & { __setMockWallet?: (value: object) => void }).__setMockWallet?.(state), mockWallet);
    await expect(approve).toBeDisabled();
    await expect(supplyAction.getByRole("status").filter({ hasText: message })).toBeVisible();
    await page.evaluate(() => (window as Window & { __setMockWallet?: (value: object) => void }).__setMockWallet?.({
      connected: true,
      chainId: 4663,
      tokenBalance: 2_100_000n,
      feeEstimateCovered: true,
    }));
    await expect(approve).toBeEnabled();
  }
});
