import { expect, test } from "@playwright/test";

const site = "http://127.0.0.1:3100";
test.setTimeout(60_000);

test("contracts selector preserves Testnet and shows independently checked Mainnet evidence", async ({ page, context }) => {
  const writeMethods: string[] = [];
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route(/^https:\/\/rpc\.(mainnet|testnet)\.chain\.robinhood\.com\//, async (route) => {
    const request = route.request().postDataJSON() as { id: number; method: string };
    if (/sendTransaction|sendRawTransaction|wallet_sendCalls|sign/i.test(request.method)) writeMethods.push(request.method);
    await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, result: request.method === "eth_chainId"
      ? route.request().url().includes("mainnet") ? "0x1237" : "0xb626"
      : request.method === "eth_getCode" ? "0x6000" : "0x0" } });
  });
  await page.route("https://robinhoodchain.blockscout.com/api/v2/addresses/**", async (route) => {
    await route.fulfill({ json: { is_verified: route.request().url().toLowerCase().includes("803c6f452abdb5b9a23dadba8d7e157ba55b6dea") } });
  });
  await page.route("https://explorer.testnet.chain.robinhood.com/api?**", async (route) => {
    const address = new URL(route.request().url()).searchParams.get("address");
    await route.fulfill({ json: { status: "1", result: [{ Address: address, SourceCode: "pragma solidity ^0.8.28;", ABI: "[]" }] } });
  });

  await page.goto(`${site}/contracts`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".cdir__addr")).toHaveCount(10);
  const testnetAddresses = await page.locator(".cdir__addr").allTextContents();
  await expect(page.getByRole("button", { name: /Robinhood Testnet/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Robinhood Mainnet/ }).click({ force: true });
  await expect(page.getByRole("button", { name: /Robinhood Mainnet/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cdir__addr")).toHaveCount(10);
  await expect(page.locator(".cdir__stats")).toContainText("Bytecode confirmed");
  await expect(page.locator(".cdir__stats")).toContainText("1/10");
  await expect(page.locator(".cdir__status").filter({ hasText: "Bytecode confirmed" })).toHaveCount(10);
  await expect(page.locator(".cdir__status").filter({ hasText: "Source verified" })).toHaveCount(1);
  await expect(page.locator(".cdir__note")).toContainText("not redeemable");
  await expect(page.locator(".cdir__note")).toContainText("not production-ready");
  const mainnetAddresses = await page.locator(".cdir__addr").allTextContents();
  expect(mainnetAddresses).toContain("0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1");
  expect(mainnetAddresses).toContain("0xC59B87173B03b030482e5FF8234CBbFD702A49b9");
  for (const href of await page.locator(".cdir__actions a").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))) {
    expect(href).toMatch(/^https:\/\/robinhoodchain\.blockscout\.com\/address\/0x/);
  }
  await page.getByRole("button", { name: "Copy address" }).first().click({ force: true });
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mainnetAddresses[0]);

  await page.evaluate(() => (document.querySelectorAll(".cdir__net-opt")[0] as HTMLButtonElement).click());
  await expect(page.locator(".cdir__addr")).toHaveCount(10);
  expect(await page.locator(".cdir__addr").allTextContents()).toEqual(testnetAddresses);
  for (const href of await page.locator(".cdir__actions a").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))) {
    expect(href).toMatch(/^https:\/\/explorer\.testnet\.chain\.robinhood\.com\/address\/0x/);
  }
  expect(writeMethods).toEqual([]);
});

test("Mainnet RPC failures leave receipt status intact", async ({ page }) => {
  await page.route("https://rpc.mainnet.chain.robinhood.com/**", (route) => route.abort());
  await page.route("https://robinhoodchain.blockscout.com/api/v2/addresses/**", (route) => route.abort());
  await page.goto(`${site}/contracts`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Robinhood Mainnet/ }).click({ force: true });
  await expect(page.locator(".cdir__status").filter({ hasText: "Deployed · receipt confirmed" })).toHaveCount(10);
  await expect(page.locator(".cdir__status").filter({ hasText: "Bytecode status unavailable" })).toHaveCount(10);
  await expect(page.locator(".cdir__status").filter({ hasText: "Source status unavailable" })).toHaveCount(10);
});

test("landing roadmap completes controlled deployment and keeps production pending", async ({ page }) => {
  await page.goto(site, { waitUntil: "domcontentloaded" });
  const phase = page.locator(".lp-phase").last();
  await expect(phase).toContainText("Controlled Mainnet Deployment");
  await expect(phase).toContainText("Completed");
  await expect(phase).toContainText("chain 4663");
  await expect(page.locator("#roadmap .lp-lead").last()).toContainText("Public Production Readiness — Pending");
});
