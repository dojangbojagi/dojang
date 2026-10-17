import { expect, test } from "@playwright/test";

const site = process.env.UI_BASE_URL ?? "http://127.0.0.1:3100";

test("network picker is Radix-based, selection stays distinct from the real wallet, and header fits target widths", async ({ page }) => {
  await page.goto(`${site}/docs`, { waitUntil: "domcontentloaded" });
  const header = page.locator(".site-header");
  const trigger = header.getByRole("combobox", { name: "Select application network" });

  await expect(header.locator("select")).toHaveCount(0);
  await expect(header.locator("[role=combobox]")).toHaveCount(1);
  await expect(header.locator("[data-wallet]")).toHaveCount(1);
  await expect(header.getByRole("button", { name: /Connect Wallet/ })).toBeVisible();

  await trigger.click();
  await expect(page.getByRole("option", { name: "Robinhood Mainnet — 4663" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Robinhood Testnet — 46630" })).toBeVisible();
  await page.getByRole("option", { name: "Robinhood Mainnet — 4663" }).click();
  await expect(trigger).toContainText("Mainnet");
  await expect(header.getByRole("button", { name: /Connect Wallet/ })).toBeVisible();
  await expect(header.getByText("Wallet disconnected", { exact: true })).toBeVisible();

  for (const width of [1920, 1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await header.locator(".site-header__inner").evaluate((inner) => {
      const box = inner.getBoundingClientRect();
      const brand = inner.querySelector(":scope > .brand")!.getBoundingClientRect();
      const nav = inner.querySelector(":scope > .nav")!;
      const network = inner.querySelector(".protocol-network-picker")!.getBoundingClientRect();
      const wallet = inner.querySelector("[data-wallet]")!.getBoundingClientRect();
      const menu = inner.querySelector(".menu-toggle")!.getBoundingClientRect();
      const actions = inner.querySelector(":scope > .site-header__actions")!.getBoundingClientRect();
      const navVisible = getComputedStyle(nav).display !== "none";
      const navBox = nav.getBoundingClientRect();
      return {
        innerWidth: box.width,
        scrollWidth: (inner as HTMLElement).scrollWidth,
        navVisible,
        brandRight: brand.right,
        navLeft: navBox.left,
        navRight: navBox.right,
        actionsLeft: actions.left,
        networkRight: network.right,
        walletLeft: wallet.left,
        walletRight: wallet.right,
        menuLeft: menu.left,
      };
    });
    expect(layout.scrollWidth, `header content overflow at ${width}px`).toBeLessThanOrEqual(layout.innerWidth + 1);
    if (layout.navVisible) {
      expect(layout.brandRight, `brand overlaps nav at ${width}px`).toBeLessThanOrEqual(layout.navLeft + 1);
      expect(layout.navRight, `nav overlaps actions at ${width}px`).toBeLessThanOrEqual(layout.actionsLeft + 1);
    } else {
      await expect(header.getByRole("button", { name: "Open menu" })).toBeVisible();
    }
    expect(layout.networkRight, `network picker overlaps wallet control at ${width}px`).toBeLessThanOrEqual(layout.walletLeft + 1);
    if (width <= 1439) {
      expect(layout.walletRight, `wallet control overlaps menu at ${width}px`).toBeLessThanOrEqual(layout.menuLeft + 1);
    }
    await page.screenshot({ path: `/tmp/gyevo-network-header-${width}.png`, fullPage: false });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".menu-toggle").click();
  await expect(page.getByRole("navigation", { name: "Primary mobile" }).getByRole("link", { name: "Lending" })).toBeVisible();
  await expect(page.getByText(/App network: Robinhood Chain Mainnet · chain 4663/)).toBeVisible();
  await expect(page.getByText(/Actual wallet network: Wallet disconnected/)).toBeVisible();
});

test("Mainnet Lending uses its own deployed registry and remains unsigned without a connected wallet", async ({ page }) => {
  await page.goto(`${site}/lending`, { waitUntil: "domcontentloaded" });
  const header = page.locator(".site-header");
  const trigger = header.getByRole("combobox", { name: "Select application network" });
  if (!(await trigger.innerText()).includes("Mainnet")) {
    await trigger.click();
    await page.getByRole("option", { name: "Robinhood Mainnet — 4663" }).click();
  }

  const context = page.getByRole("region", { name: "Lending V2 status" });
  await expect(context).toContainText("4663", { timeout: 30_000 });
  await expect(context.getByRole("link", { name: /0x8706/i })).toHaveAttribute(
    "href",
    "https://robinhoodchain.blockscout.com/address/0x8706B2fe815fB3C5986acE47b59bE0853567B48D",
  );
  await expect(page.getByRole("heading", { name: "dUSD" }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "dCOL" }).first()).toBeVisible({ timeout: 30_000 });
  await expect(context).toContainText("Not connected");
  await expect(header.getByRole("button", { name: /Connect Wallet/ })).toBeVisible();
  await page.screenshot({ path: "/tmp/gyevo-lending-mainnet-readonly.png", fullPage: false });
});
