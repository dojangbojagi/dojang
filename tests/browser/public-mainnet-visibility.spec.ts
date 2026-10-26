import { expect, test } from "@playwright/test";

const site = process.env.UI_BASE_URL ?? "http://127.0.0.1:3100";
const mainnetVisible = process.env.EXPECT_MAINNET_VISIBLE === "true";

test.skip(!process.env.UI_BASE_URL, "Set UI_BASE_URL to a running GYEVO site.");

test("the application X link opens the official account", async ({ page }) => {
  await page.goto(`${site}/app`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-header__social")).toHaveAttribute("href", "https://x.com/useegyevo");
  await expect(page.locator(".site-header__social")).toHaveAttribute("target", "_blank");
});

test("public network selection follows the Mainnet visibility flag", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("gyevo:robinhood-network", "4663"));
  await page.goto(`${site}/app?network=mainnet&chainId=4663`, { waitUntil: "domcontentloaded" });
  const picker = page.getByRole("combobox", { name: "Select application network" });
  if (mainnetVisible) {
    await expect(picker).toContainText("Mainnet");
    await picker.click();
    await expect(page.getByRole("option", { name: /Robinhood Mainnet/ })).toHaveCount(1);
    await expect(page.getByRole("option", { name: /Robinhood Testnet/ })).toHaveCount(1);
    await page.getByRole("option", { name: /Robinhood Testnet/ }).click();
    await expect(picker).toContainText("Testnet");
    await picker.click();
    await page.getByRole("option", { name: /Robinhood Mainnet/ }).click();
    await expect(picker).toContainText("Mainnet");
  } else {
    await expect(picker).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("gyevo:robinhood-network"))).toBe("46630");
  }
  await expect(page.locator(".site-header__social")).toBeVisible();
  await expect(page.locator(".site-header").getByRole("button", { name: /Connect Wallet/ })).toBeVisible();
});

test("landing removes demo marketing copy while preserving the hero destination", async ({ page }) => {
  await page.goto(site, { waitUntil: "domcontentloaded" });
  const hero = page.locator(".lp-hero");
  await expect(hero.locator(".lp-badge")).toContainText(mainnetVisible ? "Robinhood Mainnet" : "Robinhood Testnet");
  await expect(hero.locator(".lp-badge")).toContainText("Not audited");
  await expect(hero.locator(".lp-badge")).toContainText("No funds held");
  await expect(hero.locator(".lp-btn--primary")).toHaveText(/Launch App/);
  await expect(hero.locator(".lp-btn--primary")).toHaveAttribute("href", "/dojang");
  expect(await page.locator(".lp").textContent()).not.toMatch(/\bdemo\b/i);
});

test("application routes have no top announcement strip or reserved space", async ({ page }) => {
  for (const route of ["/app", "/docs", "/contracts", "/dao", "/lending", "/dojang", "/bojagi"]) {
    await page.goto(`${site}${route}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".proto-bar")).toHaveCount(0);
    await expect(page.locator(".site-header")).toBeVisible();
    expect(await page.locator(".site-header").evaluate((header) => header.getBoundingClientRect().top)).toBe(0);
  }
});

test("landing, documentation, and contracts follow the Mainnet visibility flag", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/docs", "/contracts", "/dao", "/lending", "/dojang", "/bojagi"]) {
      await page.goto(`${site}${route}${mainnetVisible ? "" : "?network=mainnet&chainId=4663"}`, { waitUntil: "domcontentloaded" });
      const visibleText = await page.locator("body").evaluate((body) => (body as HTMLElement).innerText);
      if (mainnetVisible) {
        if (["/", "/docs", "/contracts"].includes(route)) expect(visibleText).toContain("Mainnet");
      } else {
        expect(visibleText, `${route} at ${viewport.width}px`).not.toContain("Mainnet");
      }
      if (route === "/contracts") {
        await expect(page.getByRole("button", { name: /Robinhood Mainnet — Deployed/ })).toHaveCount(mainnetVisible ? 1 : 0);
        expect(await page.locator(".cdir__addr").count()).toBeGreaterThanOrEqual(10);
        if (!mainnetVisible) await expect(page.locator(".cdir__actions a[href*='robinhoodchain.blockscout.com']")).toHaveCount(0);
      }
    }
  }
});
