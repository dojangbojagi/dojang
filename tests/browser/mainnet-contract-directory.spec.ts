import { expect, test } from "@playwright/test";

const site = process.env.UI_BASE_URL ?? "http://127.0.0.1:3100";
test.skip(!process.env.UI_BASE_URL, "Set UI_BASE_URL to a running GYEVO site for these UI checks.");
test.setTimeout(60_000);

test("contracts selector preserves Testnet and shows independently checked Mainnet evidence", async ({ page, context }) => {
  const writeMethods: string[] = [];
  page.on("request", (request) => {
    const method = request.postData()?.match(/"method"\s*:\s*"([^"]+)"/)?.[1];
    if (method && /sendTransaction|sendRawTransaction|wallet_sendCalls|sign/i.test(method)) writeMethods.push(method);
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("https://rpc.mainnet.chain.robinhood.com/**", async (route) => {
    const request = route.request().postDataJSON() as { id: number; method: string };
    await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, result: request.method === "eth_chainId" ? "0x1237" : "0x6000" } });
  });
  await page.route("https://robinhoodchain.blockscout.com/api/v2/addresses/**", async (route) => {
    await route.fulfill({ json: { is_verified: route.request().url().toLowerCase().includes("803c6f452abdb5b9a23dadba8d7e157ba55b6dea") } });
  });

  await page.goto(`${site}/contracts`);
  await expect(page.getByRole("button", { name: /Robinhood Mainnet — Deployed/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cdir__addr")).toHaveCount(10);
  await expect(page.locator(".cdir__stats")).toContainText("Bytecode confirmed");
  await expect(page.locator(".cdir__stats")).toContainText("1/10");
  await expect(page.locator(".cdir__status").filter({ hasText: "Bytecode confirmed" })).toHaveCount(10);
  await expect(page.locator(".cdir__status").filter({ hasText: "Source verified" })).toHaveCount(1);
  await expect(page.locator(".cdir__note")).toContainText("no redemption value");
  await expect(page.locator(".cdir__note")).toContainText("paused");
  const mainnetAddresses = await page.locator(".cdir__addr").allTextContents();
  expect(mainnetAddresses).toContain("0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1");
  expect(mainnetAddresses).toContain("0xC59B87173B03b030482e5FF8234CBbFD702A49b9");
  for (const href of await page.locator(".cdir__actions a").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))) {
    expect(href).toMatch(/^https:\/\/robinhoodchain\.blockscout\.com\/address\/0x/);
  }
  await page.evaluate(() => (document.querySelector(".cdir__copy") as HTMLButtonElement).click());
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mainnetAddresses[0]);

  await page.evaluate(() => (document.querySelectorAll(".cdir__net-opt")[0] as HTMLButtonElement).click());
  await expect(page.getByRole("button", { name: /Robinhood Testnet — Interactive/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cdir__addr")).toHaveCount(10);
  const testnetAddresses = await page.locator(".cdir__addr").allTextContents();
  expect(testnetAddresses).not.toEqual(mainnetAddresses);
  for (const href of await page.locator(".cdir__actions a").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))) {
    expect(href).toMatch(/^https:\/\/explorer\.testnet\.chain\.robinhood\.com\/address\/0x/);
  }
  expect(writeMethods).toEqual([]);
});

test("Mainnet RPC and Blockscout 403 failures leave receipt status intact", async ({ page }) => {
  await page.route("https://rpc.mainnet.chain.robinhood.com/**", (route) => route.abort());
  await page.route("https://robinhoodchain.blockscout.com/api/v2/addresses/**", (route) => route.fulfill({ status: 403, contentType: "text/html", body: "Cloudflare challenge" }));
  await page.goto(`${site}/contracts`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Robinhood Mainnet/ }).click({ force: true });
  await expect(page.locator(".cdir__status").filter({ hasText: "Deployed · receipt confirmed" })).toHaveCount(10);
  await expect(page.locator(".cdir__status").filter({ hasText: "Bytecode status unavailable" })).toHaveCount(10);
  await expect(page.locator(".cdir__status").filter({ hasText: "Source Status Unavailable" })).toHaveCount(10);
  await expect(page.locator(".cdir__stats dd").last()).toHaveText("Unavailable");
});

test("landing leads with Mainnet deployment and keeps production pending", async ({ page }) => {
  await page.goto(site, { waitUntil: "domcontentloaded" });
  const phase = page.locator(".lp-phase").last();
  await expect(phase).toContainText("Robinhood Mainnet deployment");
  await expect(phase).toContainText("Completed");
  await expect(phase).toContainText("chain 4663");
  await expect(page.locator("#roadmap .lp-lead").last()).toContainText("Public Production Readiness — Pending");
  await expect(page.locator(".lp-cover .lp-sub")).toContainText("Deployed on Robinhood Mainnet");
  await expect(page.locator(".lp-facts__grid")).toContainText("10 deployed · 10 runtime bytecodes");
});

test("Docs identifies Mainnet first and Testnet as the interactive environment", async ({ page }) => {
  await page.goto(`${site}/docs`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".proto-bar")).toContainText("Deployed on Robinhood Mainnet");
  await expect(page.locator(".docs__glance")).toContainText("Robinhood Mainnet · 4663");
  await expect(page.locator(".docs__glance")).toContainText("Robinhood Testnet · 46630");
  await expect(page.locator("#network")).toContainText("DAO and Lending");
  await expect(page.locator("#network")).toContainText("Paused");
});
