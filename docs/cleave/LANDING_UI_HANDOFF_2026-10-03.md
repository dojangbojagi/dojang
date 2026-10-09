# Landing UI handoff — 3 Oct 2026

Written for the engineer / agent working on **live integration and logic** (Codex), so UI and logic stay in sync.
Author: Claude Code (UI pass). Sits next to `ROBINHOOD_YIELD_TRADING_MASTER_BRIEF_FINAL_V2.md`; it does not replace or restate it.

> The later **Update** sections supersede parts of §1–§3. In particular: `/trade` now exists (§2 "Links and market page" is obsolete), and the last update ("trade pages, floating navbar, palette") **did touch logic-adjacent files** — see its first subsection before assuming "presentation only".

## 1. Boundaries

- This pass is **presentation only**. No Web3, adapter, hook, quote, valuation or contract logic was changed.
- One pure relocation touches the adapter file: `MOCK_MARKETS` moved from `lib/adapters/mock-adapter.ts` to `lib/markets/mock-markets.ts` and is re-exported from the adapter (same import path, tests unchanged). Nothing in UI imports it any more — safe to revert or keep.
- Rule from the live-integration note: **UI must not hardcode market data or token icons.** New UI reads normalized data through `useMarkets` / `useMarket` / `useFixedYieldQuote` / `useLongYieldQuote` and renders icons with `AssetIcon` (`assetMetadata.iconUrl`).
- Files owned by logic work and left alone: `lib/adapters/*`, `hooks/*`, `lib/web3/*`, `lib/contracts/*`, `lib/quotes/*`, `lib/demo/*`, `lib/metadata/*`, `types/*`.

## 2. What changed (by area)

### Hero (`components/landing/Hero.tsx`, `HeroVisual.tsx`, `heroStars.ts`)
- `HeroVisual` is now a single **canvas 2D** renderer (was ~1000 mutated SVG nodes + ~100 CSS animations). Same props (`activeStage`, `onSelectStage`, `isSplitLayout`, `stagePosRef`), no new dependency.
- Planet, ring system and lattice share one frame (axial tilt + roll). Back ring halves are drawn before the body, front halves after, so rings wrap the planet. Inner ice ring = Fixed, outer amber ring = Long, dark gap = the split. Dashes are fitted to the ring perimeter so the pattern has no seam at the tips.
- Camera keyframes are expressed as screen fractions (`CAM_DESKTOP` / `CAM_COMPACT` at the top of `HeroVisual.tsx`): zoom multiplier, focus point on the planet, anchor on screen. Tune framing there.
- Interaction: hover tilt/parallax, drag with inertia, click a mini-planet to select a stage, reset button (appears after a drag). Adaptive resolution lowers the pixel ratio if the device cannot hold ~40 fps. Honors `prefers-reduced-motion`; pauses off-screen / hidden tab.
- Copy panel (left): old copy eases out, then the new copy rises in (staggered). `COPY_OUT_MS` in `Hero.tsx` must stay slightly longer than the 170 ms fade in `globals.css` (`.hero-copy`).
- Removed: decorative orbit SVG layer, `backdrop-blur` on the stage bar, dead `.orbit-*`/`.pin-*`/`.hero-svg` CSS.
- Measured (headless Chrome, same frame rate, two rounds): CPU 65–79 % → 19–30 %; worst frame during stage travel 185 ms → ~30 ms. Not a real-device number; use it only to compare old vs new.

### "Open a position" (`components/landing/TradePreview.tsx`)
- Scroll-pinned walkthrough on roomy desktops (`.trade-runway` / `.trade-pin` in `globals.css`, media query mirrored by `PIN_QUERY` in the component — keep both in sync). Below `lg` or below 700 px height it is a normal stack and steps are tapped.
- Three steps (Strategy → Amount → Review) following the brief's Fixed / Long flows; PT/YT only as "powered by"; the Long risk sentence is the brief's wording.
- Review step has a lending-rate scenario switch to show *why* Fixed does not move (locked at purchase) while Long does.

### Links and market page
- `/trade` does not exist. Landing CTAs now go to `/markets/<id>?strategy=fixed|long&amount=<n>`. `app/markets/[marketId]/page.tsx` parses `strategy` / `amount` (Promise `searchParams`, validated; bad values fall back) and passes `initialStrategy` / `initialAmount` through `MarketDetailClient` to `TradePanel`.
- "Explore Contract Specs" → `/contracts`.

### Contracts (`components/contracts/*`, `components/layout/Navbar.tsx`)
- Navbar has a **Contracts** item. Network picker is a keyboard-accessible listbox (`NetworkSelect.tsx`) instead of a native `<select>`.

### Scroll reveal (`components/landing/ScrollReveal.tsx`, `globals.css`)
- Blocks tagged `data-reveal` ease in / out as they cross a viewport band. Never put `data-reveal` on an element that has its own `transition` (the reveal rules own `transition`).

## 3. Open items for the logic side

1. **Hardcoded landing data that should move to hooks** (UI is not yet fed by normalized data here): Hero stage stats and CTA hrefs (`usdg-morpho-26mar27`), `MarketsPreview` sample rows, `StrategySection` constants (16.9x, 6.23 %, 0.941/0.059), `FinalCTA` href. A single `useFeaturedMarket()` selector would remove most of it.
2. **Two number models on the landing.** The educational demo in `lib/demo/yield-split-demo.ts` (PT 0.941 → 16.9x) differs from the quote engine (PT ≈ 0.970, YT ≈ 0.030, ≈ 33x, break-even 6.23 %). Hero stage 1/2 and `StrategySection` still follow the demo; the market page and the walkthrough follow the engine. Decide one model.
3. `StrategySection` Long card shows −42.5 % at a 7.1 % rate while labelling break-even 6.23 % — a symptom of (2).

## 4. Gotchas

- Tailwind opacity steps **8, 12, 14, 16, 18 generate no CSS** (`border-white/12` renders as bright `#e5e7eb`). Use 10 / 15 / 20 / 25 / 35. Still used by many older components (markets, portfolio, strategy…); untouched.
- Hero canvas text uses the `Geist Mono` face loaded from `globals.css`; it repaints once the font is ready.
- Re-read files before editing: commits and parallel edits land continuously in this repo.

## 5. Verification run

`tsc --noEmit`, `eslint .`, `bun test` (23 pass) and `next build --webpack` all passed at the end of the pass. Behaviour checked in headless Chrome at 1920×1080, 1470×800, 1280×720, 1024×768, 768×1024 and 390×844.

---

## Update — polish round (same day)

UI only again; no logic file was touched. Everything below reads market data through the existing hooks.

### Data wiring (answers the live-integration note)
- New `components/landing/featuredMarket.ts`: `pickFeaturedMarket(markets)` = first tradable market **in the adapter's own order** (so the data side controls what leads), `marketHref(id, strategy?, amount?)`, and `DEFAULT_TICKET` (1,000) — the one reference ticket shared by the walkthrough and the split section so both hit the same cached quote key. The old `sampleMarket.ts` (hardcoded id) is deleted.
- `TradePreview.tsx` now uses `useMarkets`, `useFixedYieldQuote`, `useLongYieldQuote`, `useNetworkGuard`, `useTokenBalance`; icon via `AssetIcon`; data-mode label via `DataModeBadge`. Loading and "no market / error" states are real UI. Amount typing is debounced (350 ms) before it reaches the quote hooks, and the last good quote stays on screen (dimmed) while the next loads.
- No hardcoded wallet balance any more: shortcuts are 25 / 50 / MAX of the real balance when connected, fixed 100 / 500 / 1,000 otherwise. The preview does not block on balance (the market page does).
- `estimatedReturns` became optional on `LongYieldQuote`; when an adapter omits it the three lending-rate cases are derived from the quote's own fields (`rateScenarios()` in `TradePreview.tsx`). Worth keeping in mind if live quotes change shape.

### Open a position — Review step
- The "Rate drops / now / rises" tabs were always clickable; for Fixed nothing visibly changed because the payout is locked, which read as "disabled". Fixed now compares its locked payout with simply holding the vault at the chosen rate (`Fixed · stays` vs `Floating at x%`, plus a one-line verdict), so every click is visible. Long was already reactive.

### The Split Engine (`components/landing/YieldSplitSection.tsx`) — one frame
- Exactly one viewport on screens ≥ 1024 × 700 (`.zs-frame` in `globals.css`); flows normally elsewhere. The three summary cards were folded into the diagram (end-of-branch chips, branch captions, footer legend), so no content below the diagram.
- New diagram: vault module with token icon, soft-halo branches, shaded "locked" and "floating" areas, parity line, date chip that rides the handle, elapsed-time fill on the axis, a pulse on the handle until first use.
- Entrance (`.zs-*` CSS, driven by `data-zs` on the section): vault → asset line draws in → split node pops → Fixed and Long branch out → captions → flow dots. Replays whenever the frame re-enters view; shows everything at once with `prefers-reduced-motion` or before JS.
- Handle is a real slider (`role="slider"`, ←/→ ±5 %, Home/End); pointer mapping uses `getScreenCTM()` so it is exact at any scale.
- The top "light" is a radial gradient that falls to zero before every edge (it used to be a 384×12 px box with a hard edge).
- Data: symbol, name, icon, protocol, underlying/implied APY, maturity and `daysRemaining` come from the featured market; PT price from the shared fixed quote. `lib/demo/yield-split-demo.ts` is **unchanged** — the section builds a `YieldSplitDemoMarket` from live data and only the simulation parameters (offsets, thresholds, unit amount) remain the demo's. Offsets are scaled to the market's length so short/long markets keep the same timeline shape.
- Visible consequence: PT VALUE now reads ≈ $0.970 and exposure ≈ 33.5x (the quote engine) instead of the demo's $0.941 / 16.9x, so this section now agrees with the walkthrough and the market page. Hero stage 1/2 stats and `StrategySection` still show the demo model (see §3).

### Verification (end of day)
`tsc --noEmit`, `eslint .`, `bun test` (28 pass) and `next build --webpack` pass. Checked in headless Chrome: drag, keyboard slider, zipped state, reduced motion, 1920 / 1470 / 1280 / 1024 / 390 widths. Working-tree changes under `hooks/` and `lib/adapters/` at the time of writing belong to the logic work, not this pass.

---

## Update — live-data wiring audit (same day)

Verified against the real Pendle list on chain 4663 and the Alchemy RPCs (`eth_chainId` OK on both; both builds, mock and live, render with no console errors).

**Landing now reads normalized data everywhere it shows a market** (via `useMarkets` / quote hooks; nothing hardcoded): Hero stage stats / copy / CTA links (`heroStages.ts`), Markets table (`MarketsPreview.tsx`, icons through `AssetIcon`, `DataModeBadge`), strategy simulator (`StrategySection.tsx`), split engine, walkthrough, final CTA. Shared selection lives in `featuredMarket.ts`:
- `isFeaturable`: tradable, `daysRemaining > 0`, implied / underlying APY within 0–100 %, liquidity > 0 (the live list contains matured markets and raw values such as an implied APY of 3,916 %).
- `pickFeaturedMarket`: active + yielding first, then adapter order. `pickPreviewMarkets`: most liquid featurable.
- `DEFAULT_TICKET`: 1,000 in mock, **100 in live** — quotes are in token units and a thin book rejects 1,000 of a ~$100 token (`Multi-routing: No routes available`).
- Landing prices are shown in the market's own asset (`0.984 USDG`), not `$`.

**For the logic side (not changed here):**
1. Live `getMarkets()` returns matured and absurd markets; filtering is done in the UI only. Consider flagging/filtering in the adapter.
2. Long quotes fail on some markets even at small tickets (NVDA: `No routes available` for YT); the UI shows `—`.
3. The live adapter is mainnet-only: `NEXT_PUBLIC_ROBINHOOD_CHAIN_ENV=testnet` + `live` yields no markets.
4. The Alchemy RPC key is a `NEXT_PUBLIC_*` variable, so it ships to the browser. Restrict it by allowed domains in the Alchemy dashboard. Vercel needs both RPC URLs, `…_CHAIN_ENV` and `…_DATA_MODE` set, then a redeploy.
5. Still static by design: `MaturityPreview` (illustrative portfolio simulation) and the Hero headline "10x Yield Exposure." (live leverage differs by market).

---

## Update — trade pages, floating navbar, palette (same day, evening)

Written for the logic side again. Verified with `tsc --noEmit`, `eslint .`, `bun test` (69 pass) and `next build --webpack`, plus headless-Chrome checks at 1440×900, 1000×420 @2x and 390×844.

### Boundary change (supersedes §1 for this round)
Unlike the earlier passes, this round edited a few logic-adjacent files. Each change is small and covered by tests; please review them:

| File | Change |
|---|---|
| `hooks/useNetworkGuard.ts` | `switchToRobinhood(targetChainId = getConfiguredChainId())`; `TradePanel` now passes `market.chainId` (it used to always switch to the configured chain, which loops when the market lives on another one). |
| `hooks/useTokenBalance.ts` | Returns an extra `hasBalance` (`query.data !== undefined`). `balance` still falls back to `0` before the first read. |
| `lib/markets/balance-shortcuts.ts` | New pure `hasInsufficientBalance({ isConnected, hasBalance, error, balance, amount })`. |
| `lib/markets/trade-strategy.ts` | New pure `isSettledTransactionStep(step)`. |
| `lib/utils/formatters.ts` | New `formatPriceImpact` (`<0.01%` for tiny values) and `formatNetworkFee` (`~0.000010 ETH`, `<0.000001 ETH`, never a misleading `0`). |
| tests | `balance-shortcuts.test.ts`, `trade-strategy.test.ts`, new `lib/utils/formatters.test.ts`. |

`types/*`, `lib/adapters/*`, `lib/contracts/*`, `lib/quotes/*` were **not** touched.

### Routes (replaces the `/trade does not exist` note in §2)
- `/trade` is the hub; `/trade/[marketId]?strategy=fixed|long` is the workspace (`TradeWorkspaceClient` + `TradePanel`). Landing links go through `marketHref()` in `featuredMarket.ts` and already point to `/trade/<id>`.
- Market detail: the Fixed / Long rows in "Strategy overview" are links to `buildTradeWorkspaceHref(id, strategy)`; the "Trade Yield →" button goes to `/trade/<id>`. Without `?strategy=` the workspace shows two selectable strategy cards instead of a dead end.

### Trade hub = the Markets table
- `MarketTable` got an **opt-in trade variant** (`tradeHrefs`, `defaultSort`, `TRADE_COLS`); `MarketCard` got `tradeHrefs`. The last column becomes "TRADE" with **Fixed ↗** / **Long ↗** actions. `/markets` renders the same markup as before.
- `TradeMarketHub` filters with `isMarketTradable(market)` and shows the same header + four stat tiles as `/markets`.
- `MarketMetricsStrip` (new, `components/markets/`) is the shared four-cell strip used by market detail and the workspace.
- New `xs` size on `AssetIcon` (source-protocol pill in the detail headers).

### Logic fixed in the trade path (what the audit found)
1. **False "Insufficient balance".** The balance hook returns `0` until the first read and when the read fails, so every amount looked unaffordable. The check now needs a balance that was actually read (`hasBalance`, no error).
2. **Wrong-network switch target** — see the table above.
3. **Transaction-state reset timer.** The 3 s `idle` reset was never cancelled, so it could wipe the state of a newer attempt (re-enabling the button mid-flight). The timers are refs, cleared on the next attempt and on unmount, and only settled states (`success` / `error` / `approval-success`) are cleared.
4. **One definition of "tradeable".** Everything uses `getMarketStatus` / `isMarketTradable` (date-aware); paused vs matured messages follow it.
5. **Raw numbers.** Price impact (`0.007949170015582442%`), network fee (`~0.000010479932584 ETH`), break-even / scenario APYs and the chart legend are formatted.
6. **Brief rows.** Fixed panel: Implied APY, Maturity + days left. Long panel: Underlying APY, Implied APY, Maturity + days left and the brief's break-even sentence.

### Not done — for the logic side
1. **Slippage** and **claimable yield** are required by the brief's Fixed / Long panels but are not on the quote types, so they are not shown (nothing invented).
2. **Status vs date.** With live data `/markets` still labels some markets "Active" while they show `0 DAYS` and a 0.00 % implied APY (e.g. sNET, maturity 17 Sept 2026 on 3 Oct). `/trade` hides them because it is date-based; consider normalizing `status` in the adapter. `/markets` was deliberately left alone.

### Floating navbar (landing only)
- `components/landing/FloatingNav.tsx`, `liquidGlass.ts` (+ test), `.lg-*` block at the end of `globals.css`; mounted once in `app/page.tsx`. The hero keeps its own navbar inside the pinned scene; this one appears when the hero (pinned runway included) has fully left the viewport and disappears again when scrolling back.
- **Coupled to the hero's `id="top"`** (`IntersectionObserver`; fallback is `scrollY > innerHeight`). Do not rename or remove it. While hidden the nav is `inert`.
- Looks: dark glass (near-clear dark tint; gloss comes from rim light, specular arc and refraction, not a white fill), glass hover bead, pointer-follow highlight, one-time sweep, solid orange "Launch app" with white semibold text. `z-40`, below `SplashScreen` (`z-[9999]`).
- Refraction is **Chromium only**: a canvas-generated displacement map (`computeLensMap`) feeds an SVG filter used from `backdrop-filter: url(#yeltra-liquid-lens)`; the map is rebuilt when the pill resizes. Elsewhere the plain blur/gloss fallback is used (`supportsBackdropLens` checks for `Chrome/` in the UA; headless Chrome reports `HeadlessChrome/`).
- Two traps worth remembering: `<g>` wrappers inside `<filter>` are invalid and turn the pill white; `feBlend mode="screen"` for the three-channel merge also goes white in Chromium — the merge uses `feComposite operator="arithmetic"`.
- The link list is a copy of the one in `Navbar.tsx`; keep them in sync when a menu item changes.

### Palette (vivid, not pastel)
- `tailwind.config.ts`: `ice` `#A9C8EE → #3B86FF`, `amber` `#F0A85C → #EF5F22` (reference: Helius orange, measured ≈ rgb 214,79,52); glow tokens follow. `amber.primary` (`#F07A2B`, the Saturn orange) is unchanged; `ice.light` / `amber.light` are unused.
- The old values were also hardcoded as hex / `rgba(...)` / bare `"169,200,238"` triplets across landing, charts and layout files; all were replaced mechanically (grep for `59, 134, 255` and `239, 95, 34`, plus the bare triplets in `HeroVisual.tsx`). **New code should use the tokens**, not new hex values.
- Contrast: dark labels on the new fills are ≈ 5–6:1; the white label on the orange nav button is ≈ 3.3:1 (user request) — it carries a small text shadow.
- `next dev` caches the Tailwind config: restart it after editing tokens.

### Hero planet light follows the stage
- The planet's atmosphere + limb are now four pre-built gradients (`LimbKey`: white / ice / amber / mint) cross-faded by eased weights: stage 0 and 3 white, 1 blue, 2 orange, 4 green. Rings, moons and the back glows (`haloIce` / `haloAmber`) are unchanged.
- `limbWeights(s)` creates the weights lazily because Fast Refresh keeps the old sim object alive; without it one missing field throws inside the frame loop and freezes the planet until a full reload.

### Buttons and cursor
- The global `a:hover { color: #fff }` makes the label of an anchor-styled button white on hover (invisible on a white or light fill). Coloured CTAs (`bg-ice`, `bg-amber`) no longer use `hover:bg-white`; they keep their hue (brighter, lifted 1 px, same-colour glow) and carry an explicit `hover:text-[#0A0C10]`. White buttons keep `hover:bg-white` plus `hover:text-background`. The global rule was left alone on purpose (it gives every other link its hover feedback); new anchor buttons with dark labels need the explicit hover text class.
- A zero-specificity `:where(...)` rule in `globals.css` sets `cursor: pointer` on links, enabled buttons, tabs, `summary`, `select`, `label[for]` and checkbox / radio / range inputs, so utilities such as `cursor-not-allowed` still win.

### Gotchas added today
- Only one `next dev` can run per project directory. To check a build on another port use `next build --webpack` then `next start -p <port>`; production always picks up the latest Tailwind config.
- Tailwind opacity steps 8 / 12 / 14 / 16 / 18 are still invalid (see §4). New and rewritten code in this round uses 10 / 15 / 20 (the trade workspace, market detail and `TradePanel` borders were fixed). Two pre-existing `/markets`-only lines were left as they are because `/markets` was not to change: `MarketCard` (`border-white/14`) and the `MarketTable` search input (`border-white/12`).

---

## Update — product copywriting (same day, night)

Copy only: no layout, styling, routing, hook, adapter or transaction logic changed (the one non-UI file touched is `lib/adapters/mock-adapter.ts`, two error-message strings).

### Naming rule
- User-facing: **Fixed Yield** and **Trading Yield**. "Long Yield" no longer appears anywhere a user can read it.
- Internal, unchanged on purpose: `strategy=long`, the `"long"` enum / `kind: "long"`, `useLongYieldQuote`, `openLongPosition`, `hrefs.long`, `LongYieldQuote`, the `#long` docs anchor, YT mechanics, test names. Do not rename these to match the copy.
- PT / YT stay as secondary information ("Powered by PT", "(PT)", the glossary, the advanced panel), never as the first label.

### Voice
- Fixed Yield = lock a quoted yield toward maturity (more predictable, early exit is market-priced). Trading Yield = trade exposure to future yield as rates move (value can fall).
- No guarantee language: "Guaranteed payout" → "Quoted payout", "APY LOCKED" → "QUOTED APY", "certainty" → "predictability"; "leverage" → "exposure"; "bet / speculation" removed.
- Markets = research ("Explore live yield markets. Compare rates, maturity, liquidity…"); `/trade` = execution ("Choose a live market. Then lock a quoted yield with Fixed Yield, or trade future yield with Trading Yield."); Portfolio = position management (Active / Claim Yield / Sell Early / Redeem at Maturity for Fixed; Expires at Maturity for Trading Yield).
- Wallet: browsing and quotes never need a wallet; the panel CTA reads "Connect wallet to execute".

### Where the copy lives
- Hero: `components/landing/heroStages.ts` (stage text, tab names, CTAs; numbers still come from the market and quotes), `STAGE_SHORT` in `Hero.tsx`, planet pin labels in `PIN_STYLE` / `HeroLabels` in `HeroVisual.tsx`.
- Table / card trade actions: `MarketTable.tsx` (`Fixed` / `Trading`) and `MarketCard.tsx` (`Fixed Yield →` / `Trading Yield →`); aria-labels read "Open Fixed Yield on SYM" / "Open Trading Yield on SYM".
- Kept verbatim on purpose: the brief-mandated risk sentence in the Review step and in the trade panel's Long risk notice ("If the underlying yield is lower than the implied yield you paid for, a large portion of the position value can be lost.").

### Still open
- Live-adapter error messages (`lib/adapters/pendle-live-adapter.ts`, e.g. "Only YT positions can claim yield.") still say PT / YT; they were not changed because adapters are logic-owned. If they can reach the UI, they should be reworded on that side.
- `/contracts` was left alone (registry copy is transparency text with no strategy wording, and the file is under parallel edit).
