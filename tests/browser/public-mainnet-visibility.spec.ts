import { expect, test } from "@playwright/test";

const site = process.env.UI_BASE_URL ?? "http://127.0.0.1:3100";
const mainnetVisible = process.env.EXPECT_MAINNET_VISIBLE === "true";

test.skip(!process.env.UI_BASE_URL, "Set UI_BASE_URL to a running GYEVO site.");

test("the application X link opens the official account", async ({ page }) => {
  await page.goto(`${site}/app`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-header__social")).toHaveAttribute("href", "https://x.com/useegyevo");
  await expect(page.locator(".site-header__social")).toHaveAttribute("target", "_blank");
});

test("hidden header selector preserves the Mainnet visibility flag and X link", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("gyevo:robinhood-network", "4663"));
  await page.goto(`${site}/app?network=mainnet&chainId=4663`, { waitUntil: "domcontentloaded" });
  const picker = page.getByRole("combobox", { name: "Select application network" });
  await expect(picker).toHaveCount(0);
  if (mainnetVisible) {
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("gyevo:robinhood-network"))).toBe("4663");
  } else {
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("gyevo:robinhood-network"))).toBe("46630");
  }
  await expect(page.locator(".kv__row").filter({ hasText: "Expected network" })).toContainText(
    mainnetVisible ? "Robinhood Chain Mainnet · chain 4663" : "Robinhood Chain Testnet · chain 46630",
  );
  await expect(page.locator(".site-header__social")).toBeVisible();
  await expect(page.locator(".site-header").getByRole("button", { name: /Connect Wallet/ })).toBeVisible();
});

test("landing removes demo marketing copy while preserving the hero destination", async ({ page }) => {
  await page.goto(site, { waitUntil: "domcontentloaded" });
  const hero = page.locator(".lp-hero");
  await expect(hero.locator(".lp-badge")).toContainText("GYEVO protocol");
  await expect(hero.locator(".lp-badge")).toContainText("Not audited");
  await expect(hero.locator(".lp-badge")).toContainText("Synthetic assets");
  await expect(hero.locator(".lp-btn--primary")).toHaveText(/Launch App/);
  await expect(hero.locator(".lp-btn--primary")).toHaveAttribute("href", "/dojang");
  expect(await page.locator(".lp").textContent()).not.toMatch(/\bdemo\b/i);
});

test("generic landing and app introductions do not call the product a Testnet demo", async ({ page }) => {
  for (const [route, selector] of [
    ["/", ".lp-badge"],
    ["/app", ".app-home__head"],
    ["/dojang", ".stub__lead"],
    ["/lending", ".stub__lead"],
  ]) {
    await page.goto(`${site}${route}`, { waitUntil: "domcontentloaded" });
    const copy = await page.locator(selector).innerText();
    expect(copy, `${route} generic introduction`).not.toMatch(/Robinhood Testnet|chain 46630|\bdemo\b/i);
  }
  await page.goto(`${site}/contracts#verified-history`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Explore Verified Activity" })).toBeVisible();
  await expect(page.locator("#verified-history")).toContainText("Robinhood Testnet");
});

test("landing hero displays the supplied CA with the full address available to copy", async ({ page }) => {
  await page.goto(site, { waitUntil: "domcontentloaded" });
  const ca = page.locator(".lp-hero .lp-ca");
  await expect(ca.locator(".lp-ca__label")).toHaveText("CA");
  await expect(ca).toContainText("0xae82...806f");
  await expect(ca.locator(".lp-ca__address")).toHaveAttribute("title", "0xae82c2e2dbb71ffe27d2115406dab84b91bc806f");
  await expect(ca.getByRole("button", { name: "Copy full contract address" })).toHaveCount(1);
  await expect(ca.locator(".lp-ca__chain")).toHaveCount(0);
});

test("landing CA clears the mobile hero hint", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.1));
  await expect.poll(async () => page.locator(".lp-hero").getAttribute("inert")).toBeNull();
  const ca = await page.locator(".lp-ca").boundingBox();
  const hint = await page.locator(".lp-drag-hint").boundingBox();
  expect(ca).not.toBeNull();
  expect(hint).not.toBeNull();
  expect(ca!.y + ca!.height).toBeLessThan(hint!.y - 8);
});

test("landing hero stays below navigation on compact phones with CA", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.1));
  await expect.poll(async () => page.locator(".lp-hero").getAttribute("inert")).toBeNull();
  const nav = await page.locator(".lp-nav").boundingBox();
  const badge = await page.locator(".lp-badge").boundingBox();
  const ca = await page.locator(".lp-ca").boundingBox();
  const hint = await page.locator(".lp-drag-hint").boundingBox();
  expect(nav && badge && ca && hint).toBeTruthy();
  expect(badge!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height);
  expect(ca!.y + ca!.height).toBeLessThan(hint!.y - 8);
});

test("application routes have no top announcement strip or reserved space", async ({ page }) => {
  for (const route of ["/app", "/docs", "/contracts", "/dao", "/dark-dao", "/lending", "/dojang", "/bojagi"]) {
    await page.goto(`${site}${route}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".proto-bar")).toHaveCount(0);
    await expect(page.locator(".site-header")).toBeVisible();
    expect(await page.locator(".site-header").evaluate((header) => header.getBoundingClientRect().top)).toBe(0);
  }
});

test("landing, documentation, and contracts follow the Mainnet visibility flag", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/docs", "/contracts", "/dao", "/dark-dao", "/lending", "/dojang", "/bojagi"]) {
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
