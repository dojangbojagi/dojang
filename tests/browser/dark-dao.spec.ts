import { expect, test } from "@playwright/test";

const site = process.env.TEST_SITE_URL ?? "http://127.0.0.1:3000";
const mainnetVisible = process.env.EXPECT_MAINNET_VISIBLE === "true";
const phase2Visible = process.env.EXPECT_PHASE2_VISIBLE === "true";

test("DARK DAO is discoverable from landing, app navigation, and footer", async ({ page }) => {
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lp-nav__links a[href='#dao']")).toHaveText("DARK DAO");
  await expect(page.locator("[data-feature='dao'] a[href='/dark-dao']")).toHaveText(/Explore DARK DAO/);

  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`${site}/app`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-header").getByRole("link", { name: "DARK DAO" })).toHaveAttribute("href", "/dark-dao");
  await expect(page.locator(".site-footer").getByRole("link", { name: "DARK DAO" })).toHaveAttribute("href", "/dark-dao");
  await expect(page.locator(".app-home__grid").getByRole("link", { name: /DARK DAO/ })).toHaveAttribute("href", "/dark-dao");
});

test("DARK DAO page reflects the selected network and preserves Phase 2 visibility", async ({ page }) => {
  await page.addInitScript((chainId) => window.localStorage.setItem("gyevo:robinhood-network", chainId), mainnetVisible ? "4663" : "46630");
  await page.goto(`${site}/dark-dao`, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle(/DARK DAO/);
  await expect(page.getByRole("heading", { level: 1, name: "DARK DAO" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Governance, backed by proof." })).toBeVisible();
  await expect(page.locator(".dark-dao-entry").getByRole("link", { name: "Enter DARK DAO" })).toHaveAttribute("href", "/dao");
  await expect(page.getByText(mainnetVisible ? "Robinhood Mainnet · 4663" : "Robinhood Testnet · 46630", { exact: true })).toBeVisible();
  const phase1Status = page.getByRole("region", { name: "Phase 1 live status" });
  await expect(phase1Status).toHaveCount(1);
  await expect(phase1Status).toContainText(mainnetVisible ? "Phase 1 Mainnet status is read in Contracts" : "Robinhood Testnet");
  await expect(page.getByRole("region", { name: "Phase 2 live status" })).toHaveCount(phase2Visible ? 1 : 0);

  if (mainnetVisible) {
    await expect(page.getByRole("link", { name: "Check Phase 1 Mainnet state" })).toHaveAttribute("href", "/contracts#mainnet-protocol-state-heading");
  } else {
    await expect(page.getByText(/Mainnet/)).toHaveCount(0);
  }

  const phase2Model = page.locator(".dark-dao-phase--phase2");
  await expect(phase2Model).toHaveCount(phase2Visible ? 1 : 0);
  if (phase2Visible) await expect(phase2Model).toContainText("Genuine Lending evidence");
});

test("DARK DAO page and existing DAO route fit desktop and mobile", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1600, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${site}/dark-dao`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "DARK DAO" })).toBeVisible();
    const bounds = await page.locator(".dark-dao-page").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(bounds.scrollWidth, `DARK DAO overflows at ${viewport.width}px`).toBeLessThanOrEqual(bounds.clientWidth + 1);

    await page.goto(`${site}/dao`, { waitUntil: "domcontentloaded" });
    if (viewport.width < 1440) {
      await page.locator(".site-header").getByRole("button", { name: "Open menu" }).click();
      await expect(page.locator(".mobile-nav").getByRole("link", { name: "DARK DAO" })).toHaveAttribute("href", "/dark-dao");
    } else {
      await expect(page.locator(".site-header").getByRole("link", { name: "DARK DAO" })).toHaveAttribute("href", "/dark-dao");
    }
    await expect(page.getByRole("heading", { name: /DARK DAO/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Phase 2" })).toHaveCount(phase2Visible ? 1 : 0);
  }
});
