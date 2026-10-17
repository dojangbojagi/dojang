import { expect, test } from "@playwright/test";

const site = process.env.TEST_SITE_URL ?? "http://127.0.0.1:3000";
const phase2Visible = process.env.EXPECT_PHASE2_VISIBLE === "true";

test("DAO release visibility preserves Phase 1 and gates Phase 2 by the public flag", async ({ page }) => {
  await page.route("https://rpc.testnet.chain.robinhood.com/**", (route) => route.abort());
  await page.route("https://rpc.mainnet.chain.robinhood.com/**", (route) => route.abort());
  await page.route("https://sepolia-rpc.giwa.io/**", (route) => route.abort());

  // A phase query is deliberately not a visibility bypass or an unsupported deep link.
  await page.goto(`${site}/dao?phase=2`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "GYEVO DAO · Robinhood Testnet" })).toBeVisible();
  await expect(page.locator("#dao-phase1-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh governance" })).toBeVisible();
  expect((await page.request.get(`${site}/dao/phase2`)).status()).toBe(404);

  if (!phase2Visible) {
    await expect(page.getByRole("tab", { name: "Phase 1" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Phase 2" })).toHaveCount(0);
    await expect(page.locator("#dao-phase2-panel")).toHaveCount(0);
    await expect(page.getByText("Create proposals and vote through the existing Phase 1 governance flow.")).toBeVisible();
    await page.goto(`${site}/dojang`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "DAO Governance · Phase 1" })).toBeVisible();
    await expect(page.getByText(/Policy 5/i)).toHaveCount(0);
    return;
  }

  const phase1 = page.getByRole("tab", { name: "Phase 1" });
  const phase2 = page.getByRole("tab", { name: "Phase 2" });
  await expect(phase1).toHaveAttribute("aria-selected", "true");
  await expect(phase2).toHaveAttribute("aria-selected", "false");
  await expect(phase1).toHaveAttribute("tabindex", "0");
  await expect(phase2).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tablist", { name: "DAO release" })).toHaveAttribute("aria-orientation", "horizontal");
  await expect(page.locator("#dao-phase1-panel")).toBeVisible();
  await expect(page.locator("#dao-phase2-panel")).toBeHidden();

  await phase1.focus();
  await page.keyboard.press("ArrowRight");
  await expect(phase2).toBeFocused();
  await expect(phase2).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Prove reputation, then commit a protected ballot." })).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(phase1).toBeFocused();
  await expect(phase1).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#dao-phase1-panel")).toBeVisible();
  await expect(page.locator("#dao-phase2-panel")).toBeHidden();

  await page.goto(`${site}/dojang`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Policy 5", { exact: true })).toBeVisible();

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${site}/dao`, { waitUntil: "domcontentloaded" });
    const tablist = page.getByRole("tablist", { name: "DAO release" });
    await expect(tablist).toBeVisible();
    const bounds = await tablist.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    const phase1Tab = page.getByRole("tab", { name: "Phase 1" });
    const phase2Tab = page.getByRole("tab", { name: "Phase 2" });
    await expect(phase1Tab).toBeVisible();
    await expect(phase2Tab).toBeVisible();
    const [phase1Bounds, phase2Bounds] = await Promise.all([phase1Tab.boundingBox(), phase2Tab.boundingBox()]);
    expect(phase1Bounds).not.toBeNull();
    expect(phase2Bounds).not.toBeNull();
    expect(phase1Bounds!.x).toBeGreaterThanOrEqual(0);
    expect(phase2Bounds!.x + phase2Bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    const tabsDoNotOverlap = phase1Bounds!.x + phase1Bounds!.width <= phase2Bounds!.x
      || phase2Bounds!.x + phase2Bounds!.width <= phase1Bounds!.x
      || phase1Bounds!.y + phase1Bounds!.height <= phase2Bounds!.y
      || phase2Bounds!.y + phase2Bounds!.height <= phase1Bounds!.y;
    expect(tabsDoNotOverlap).toBe(true);
  }
});
