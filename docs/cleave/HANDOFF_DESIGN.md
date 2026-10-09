# YELTRA — Design handoff: how the landing page and 3D hero are built

**Audience:** any engineer or AI agent who has to build, extend or recreate this level of landing page, in this project or the next one.
**Goal of this document:** explain *why it looks this good* and *how to do it again*, in an order you can follow. It is a playbook plus an audit of the current state (4–7 Oct 2026, `main`).

How to read it:

- Want the short version? Read **§1** (the ten rules) and **§9** (the new-project playbook).
- Changing this project? Read **§2** (where things are), **§3** (tokens), **§7** (section recipes), **§10** (audit).
- Touching the 3D planet? Read **§5** here, then `docs/HERO_3D_HANDOFF_2026-10-04.md` (every constant and formula).
- Project status, routes, env and ownership are in `docs/HANDOFF_2026-10-04.md`. Nothing here repeats it.

Everything below was checked against the code on 7 Oct 2026. File names and line counts are real.

---

## 1. Why it works: the ten rules

1. **One idea per screen, driven by scroll.** The long pages are *pinned scenes*: a tall "runway" element, a `position: sticky` frame inside it, and scroll position turned into a progress number. The page tells a story instead of stacking blocks (§6).
2. **Restraint is the style.** Near-black background, one text colour, two accents. Blue means Fixed Yield, orange means Trading Yield, everywhere. Colour always carries meaning, never decoration (§3).
3. **Thin lines, not cards.** 1 px borders at 10–15 % white, hairline rules, big numerals, small monospace labels. No shadows-as-structure, no gradients-as-fill. It reads as institutional.
4. **Type does the design.** One sans (Geist) for sentences, one mono (Geist Mono) for every label, number and data point. Huge light headlines (46–68 px, weight 400, tight tracking), tiny uppercase labels (10–11 px, wide tracking) (§3.2).
5. **Everything moves from one state, never from scattered animations.** Each scene has one simulation object and one loop. Values are *eased toward goals* (`decay`, `smoothDamp`), so nothing pops and nothing jitters (§5.4).
6. **The hero is real 3D math on a 2D canvas.** ~1,700 lines, zero dependencies, one `requestAnimationFrame` loop. Depth is faked correctly: tilt, spin, depth-bucketed lines, rings split into back and front halves (§5).
7. **Copy and data are separate from layout.** Stage text is a function of the live market and quotes. The UI never hardcodes a market number; it only chooses among what the data layer returns (§8).
8. **Every scene has a plain-flow fallback.** Pinned on big desktops; ordinary stacked content on phones, short screens and reduced motion. Same markup, CSS media query decides (§6.3).
9. **Quality is measured, not eyeballed.** Overlap, overflow and fit were checked with real measurements at six viewport sizes; hover and click with real mouse events; colours by reading computed styles (§11).
10. **Honesty rules.** No fake revenue, no fake burn totals, no "guaranteed". Illustrative widgets say so. Claim safety is a design constraint, not legal fine print (§8).

---

## 2. Anatomy of the landing page

### 2.1 Composition (`app/page.tsx`)

```tsx
<div className="bg-background text-foreground min-h-screen relative" style={{ overflowX: "clip" }}>
  <div className="relative z-10 bg-background shadow-[0_50px_120px_rgba(0,0,0,0.95)]">   {/* the "curtain" */}
    <Hero />                 {/* 275vh runway, canvas 3D, 5 stages          */}
    <YieldSplitSection />    {/* 01  360vh runway, SVG timeline diagram     */}
    <ProtocolEconomics />    {/* 02  300vh runway, 70 → 30 allocation       */}
    <StrategySection />      {/* 03  normal flow, interactive simulator     */}
    <MarketsPreview />       {/* 04  normal flow, live market table         */}
    <TradePreview />         {/* 05  290vh runway, 3-step walkthrough       */}
    <MaturityPreview />      {/* 06  normal flow, portfolio simulation      */}
  </div>
  <ScrollReveal />           {/* enter/exit of every [data-reveal] block    */}
  <FloatingNav />            {/* glass pill, appears after the hero         */}
  <div className="relative h-screen" aria-hidden />          {/* 100vh spacer */}
  <div className="fixed bottom-0 inset-x-0 h-screen z-0 …"> {/* footer, revealed under the curtain */}
    <FinalCTA /> <Footer />
  </div>
</div>
```

**The curtain trick.** The content wrapper is opaque (`bg-background`, `z-10`) with a large black shadow. Below it is a 100vh empty spacer, and behind everything a `fixed` footer frame (`z-0`, 100vh). Scrolling the spacer past makes the content "peel away" and reveal the final CTA + footer, exactly one screen. Cheap, no JS, and it gives the page a real ending.

**Numbering.** Section eyebrows are numbered (`01 — HOW YIELD SPLITS` … `06 — LIVE PORTFOLIO SIMULATION`). The numbers are plain text inside each component; inserting a section means renumbering by hand (it was done when `02 — PROTOCOL ECONOMICS` was added).

### 2.2 Scroll budget (what the visitor actually travels)

| Scene | Runway | Pin condition | Notes |
|---|---|---|---|
| Hero | `lg:min-h-[275vh]` (55vh × 5 stages) | `≥ 1024 px` wide | camera glides between stages |
| 01 Yield split | `360vh` | `≥ 1100 × 760` | handle travels Today → Maturity |
| 02 Protocol economics | `300vh` | `≥ 1024 × 720` | blue fills 0→70, orange 0→30 |
| 05 Open a position | `290vh` | `≥ 1024 × 700` | 3 steps, Strategy → Amount → Review |

Total pinned travel ≈ **12 screens** of scrolling before the simulator and tables, plus one for the footer. It feels cinematic on desktop; it is also the main thing to review if the page ever feels long (§10, A3).

### 2.3 Files

| Concern | Files |
|---|---|
| Hero | `components/landing/Hero.tsx` (536 lines), `HeroVisual.tsx` (1,684), `heroStages.ts` (270), `heroStars.ts` (102) |
| Floating nav + CA pill | `FloatingNav.tsx` (282), `liquidGlass.ts` (+ test), `ContractAddress.tsx` (168) |
| Sections | `YieldSplitSection.tsx` (874), `ProtocolEconomics.tsx` (296), `StrategySection.tsx` (470), `MarketsPreview.tsx` (139), `TradePreview.tsx` (844), `MaturityPreview.tsx` (182), `FinalCTA.tsx` (113) |
| Infra | `ScrollReveal.tsx` (54), `featuredMarket.ts` (+ test), `components/SplashScreen.tsx`, `app/globals.css` (867), `tailwind.config.ts` |

`app/globals.css` is organised in commented blocks: base and tokens, legacy SVG animations, splash, hero copy, split engine (`.zs-*`), walkthrough (`.trade-*`), scroll reveal (`[data-reveal]`), liquid glass (`.lg-*`), protocol economics (`.eco-*`).

---

## 3. Design system

### 3.1 Colour

Defined once in `tailwind.config.ts`; canvas and SVG code hard-codes the same values (so grep when you change them).

| Token | Value | Meaning |
|---|---|---|
| `background` | `#030304` | page; almost black, never pure `#000` |
| `foreground` | `#ECEDEA` | primary text (warm off-white) |
| `surface` / `surface.raised` | `#0B0B0D` / `#121215` | panels |
| `muted` ramp | `#D6D9D7` → `#B9BDBA` → `#8E9390` → `#6F7471` | body, secondary, labels, faint |
| `ice` | `#3B86FF` | **Fixed Yield**, 70 % Protocol, "calm/known" |
| `amber` | `#EF5F22` | **Trading Yield**, 30 % Burn, CTAs, "alive/variable" |
| `amber.primary` | `#F07A2B` | the Saturn logo orange only |
| `positive` / `negative` | `#8FD3A8` / `#F08A7A` | gains / losses only |
| mint (canvas only) | `52,211,153` | the "Markets" stage, the vault pin |

Rules: vivid, never pastel (the first versions used `#A9C8EE` / `#F0A85C` and looked washed out). Glass is **dark** (tinted near-black), never white-ish. Borders use opacity steps **10 / 15 / 20 / 25 / 35**. Steps 8, 12, 14, 16, 18 generate no CSS in this Tailwind setup and render as bright grey (§10, A2).

### 3.2 Typography

- **Geist** 300–600 for text, **Geist Mono** 400–500 for every label, figure, address and eyebrow (`.mono` class). Loaded through a Google Fonts `@import` at the top of `globals.css`.
- Headline scale: `34 → 46 → 58–68 px` (`text-[34px] sm:text-[46px] lg:text-[58px]`), weight 400, `leading-[1.05]`, `tracking-[-0.035em]`, `text-balance`.
- Eyebrow: `mono text-[11px] tracking-[0.22em] uppercase` with a 6 px coloured dot (`02 — PROTOCOL ECONOMICS`).
- Body: `15–17 px`, `leading-[1.6]`, `font-light`, `text-muted`.
- Metadata: `mono 10–11 px`, `tracking 0.06–0.18em`, `text-muted-dark`.
- Big numerals: `mono font-medium leading-none tracking-[-0.04em]`, 64 → 120 px.

### 3.3 Layout and spacing

- Container: `max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-10`. The navbar, hero copy and every section share the same left edge.
- Section top spacing: `pt-24 sm:pt-32 lg:pt-40`. Section header has a `border-b border-white/10`.
- Panels: `border border-white/15`, radius 0–12 px, `bg-surface/70`. Almost no shadows.
- Hover: colour and brightness only, plus a 1 px lift on coloured CTAs. Never scale layout.

### 3.4 Glass (`.lg-*` in `globals.css`)

Used only by the floating nav and the contract-address pill. The recipe, back to front:

1. `backdrop-filter: blur(3px) saturate(1.6) brightness(.95)` over a **near-clear dark tint** (`rgba(9,10,13,.4)` plus 7 % white at the top).
2. Bevel from `inset` box-shadows: bright 1 px on the top edge, faint on the others, a blue fringe on the left edge and an orange fringe on the right (like colour split on real glass), a darker thickening at the bottom.
3. `::before` rim ring (masked 1.25 px gradient, brightest top-left and bottom-right).
4. `::after` specular arc on top plus faint blue and orange light in the lower corners.
5. `.lg-glow` radial highlight that follows the pointer (`--lg-x/--lg-y`), a one-time `.lg-sweep`, a sliding `.lg-chip` hover bead.
6. **Chromium only:** the backdrop is *refracted*. `liquidGlass.ts` renders a displacement map to a PNG, an SVG `<filter>` (`feImage` + three `feDisplacementMap` at scales 34 / 46 / 58 for RGB dispersion, merged with `feComposite arithmetic`) is referenced from `backdrop-filter: url(#…)`. Safari and Firefox get steps 1–5.

Traps found while building it: a `<g>` inside `<filter>` is invalid and turns the pill white; `feBlend screen` for the three-channel merge also turns white in Chromium (use arithmetic `feComposite`); and `HeadlessChrome/` user agents must be matched with `/Chrome\/\d+/`, without `\b`.

### 3.5 Buttons and cursor

- Primary (white): `bg-foreground text-background`, hover `bg-white hover:text-background`.
- Coloured CTA: `bg-ice` / `bg-amber`, label `#0A0C10`. Hover keeps the hue (brighter, 1 px lift, same-colour glow) with an explicit `hover:text-[#0A0C10]`. The global `a:hover { color:#fff }` would otherwise turn the label white and the button into an empty white slab (this was a real bug).
- One zero-specificity rule `:where(a[href], button:not(:disabled), [role=tab], summary, select, label[for], …) { cursor: pointer }` covers every clickable thing; utilities like `cursor-not-allowed` still win.

### 3.6 Motion vocabulary

| Use | Easing / timing |
|---|---|
| Entrance of text blocks | `cubic-bezier(.16, 1, .3, 1)`, 0.55–0.9 s, stagger 55–90 ms |
| Exit | `cubic-bezier(.4, 0, 1, 1)`, 0.17–0.45 s (faster than entrance) |
| Hover / colour | 150–300 ms |
| Pin-driven values | no easing; value = function of progress (scrubbed, so it also runs in reverse) |
| Canvas values | `1 − e^(−rate·dt)` (frame-rate independent), camera by critically damped spring |
| Idle ambience | very slow: 7 s float, 12 s drift, ember loops, meteor every ~10 s |

Everything honours `prefers-reduced-motion` (§11).

---

## 4. The three scroll-driven patterns (copy these)

### 4.1 Pinned runway (the core recipe)

```css
@media (min-width: 1024px) and (min-height: 720px) {
  .x-runway { height: 300vh; margin-bottom: -4.5rem; }   /* travel distance; pull the next section up */
  .x-pin    { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; }
}
```
```tsx
// progress 0..1 over the runway
const travel   = runway.offsetHeight - window.innerHeight;
const progress = clamp01(-runway.getBoundingClientRect().top / travel);
```
Then **derive everything from `progress`**: `phase(progress, [from, to])` gives a 0..1 sub-progress for each beat (see `ProtocolEconomics.tsx`). One scroll listener, coalesced with `requestAnimationFrame`, passive, read-only. Because the page never fights the scroll (no scroll hijacking), it works with smooth-scroll engines and keyboard/anchor navigation.

Rules learned:
- Keep **CSS media query and JS `matchMedia` identical** and comment both ("keep in sync"). Today the four scenes use four different queries (§10, A3).
- The pinned frame must fit one viewport. Make the big type follow viewport **height** (`clamp(72px, 13vh, 120px)`) and measure the frame at 720, 768, 800, 900, 1080 px tall.
- If your CSS sets a property that a Tailwind `lg:` utility also sets, **raise specificity** (`#economics .eco-title`). Tailwind emits its responsive utilities *after* your rules in the built file; the first version of the font clamps silently never applied.
- Add hysteresis when progress selects a *discrete* state (hero stage: 0.028; walkthrough step: 0.09) so edges do not flicker.
- Clicks on tabs or presets should **scroll the page** to that slice of the runway, not set state directly. Scroll stays the single source of truth.

### 4.2 Autoplay fallback (no pin)

Where the pin is off (touch, short screens), the same sequence plays **once** when the section is ≥ 35 % visible (`IntersectionObserver`), driven by a `requestAnimationFrame` clock that sets the same `progress` over ~3.8 s, and rewinds to 0 after the section leaves. The render code is identical; only the source of `progress` changes. Reduced motion: set `progress = 1`.

### 4.3 Enter/exit reveal (`ScrollReveal` + `[data-reveal]`)

Tag a block `data-reveal` (optionally `="1|2|3"` for a delay tier). `ScrollReveal` classifies each block as `below`, `in` or `above` against a viewport band (14 % from the top, 8 % from the bottom) and writes `data-reveal-state`; CSS does the rest (fade + 40 px rise on entry, faster fade + 28 px lift on exit). It only runs on band crossings (IntersectionObserver), never per frame. Rules: no `data-reveal` on an element that has its own `transition`; without the attribute state, content is simply visible (works without JS).

---

## 5. The 3D hero (right side)

Short version here; the complete reference (constants, formulas, rebuild plan, tuning table) is **`docs/HERO_3D_HANDOFF_2026-10-04.md`**.

### 5.1 What it is

A single `<canvas>` painted by `HeroVisual.tsx` in one `requestAnimationFrame` loop: a glassy planet with a latitude/longitude wireframe, a rotating vault cube at its core, 96 stars on its surface, a blue ring system (Fixed) and an orange one (Trading), three moons, four mini-planets (one per stage) and a star-field backdrop with meteors. No three.js, no model, no texture; it does its own projection.

### 5.2 Why it looks like real 3D

| Technique | Effect |
|---|---|
| Axial tilt + spin with `x, y = −(Y·cosT − Z·sinT), z = Y·sinT + Z·cosT` | correct perspective rotation of every lattice point |
| **Depth buckets** (8): far lines faint, near lines bright; far buckets drawn before the core, near after | volume without lighting |
| **Rings split into back/front halves** with a 0.004 rad seam overlap | rings genuinely wrap the planet |
| Dashes **fitted to the ellipse perimeter**, back half phase-shifted by half | continuous dash flow, no cut at the tips |
| Four gradients per light (atmosphere, limb) cross-faded by eased weights | the planet's light changes colour per stage without a pop |
| Additive blending (`lighter`) for stars and glows | luminous points |
| Mini-planets drawn in screen space, un-rolled | upright, readable labels while the planet turns |
| Camera = keyframes in *screen fractions* + critically damped spring | same framing on any viewport; glides with scroll |
| Pointer parallax (≤ 6 px), hover tilt (≈ 4°), drag with inertia | feels like an object, not a video |

### 5.3 How the hero is wired (`Hero.tsx`)

- Section `id="top"`, `lg:min-h-[275vh]`, inner `lg:sticky lg:top-0`, a `100dvh` scene.
- Scroll gives `stagePosRef` (continuous, `progress·5 − 0.5`, clamped) for the camera and a discrete `activeStage` with hysteresis for copy, tint and pins.
- **Copy swap:** old copy eases out (`data-phase="out"`, 170 ms), then the new copy mounts and each block rises with `--i` stagger (`.hero-rise`). `COPY_OUT_MS` must stay slightly longer than the CSS fade.
- Stage content is `buildStages(featuredMarket, fixedQuote, longQuote)`; the planet labels (`FIXED · 3.18%`, `USDG MARKET`) come from the same market.
- A scrim (`bg-[linear-gradient(90deg, … )]`) keeps the copy column readable over the canvas; legibility is solved there, not inside the scene.
- Below 1024 px: no pin, planet dimmed to 35–50 %, swipe and tabs change stage.

### 5.4 Rules that keep the scene smooth

1. **One simulation object** (`createSim()`), one loop: `step(dt)` updates state, `paint(now)` draws it. No DOM work per frame.
2. **Ease, don't snap:** every emphasis value approaches its goal with `decay(rate, dt)`.
3. **Allocation-free frames:** memoised `rgba()` strings, preallocated `Float64Array`s, depth-bucket arrays reused.
4. **Pixel budget:** `dpr ≤ min(devicePixelRatio, 2) × quality`, capped by `√(5.2M / (W·H))`; adaptive quality drops 0.25 per 24 slow frames.
5. **Pause** off-screen and on hidden tabs. **Reduced motion:** no spin, camera snaps, loop sleeps when settled.
6. **Fast Refresh safety:** the sim object survives edits, so any field added later must be created lazily (`limbWeights(s)`), or one `undefined` freezes the planet until a reload.
7. **NaN guard:** non-finite state resets the sim instead of freezing.

---

## 6. Section recipes

For each section: idea, how it is built, and what to preserve.

### 6.1 Splash (`components/SplashScreen.tsx`)
`z-[9999]`, 8 vertical strips that slide up in a left-to-right stagger after a 1.25 s hold; wordmark letters animate in; a "Skip →" button bypasses it. Unmounts itself. Total ≈ 2.2 s.

### 6.2 Floating nav (`FloatingNav.tsx`)
Appears when the hero (`#top`, runway included) has fully left the viewport (`IntersectionObserver`, fallback `scrollY > innerHeight`); `inert` while hidden. Glass per §3.4, springy entrance (`cubic-bezier(.34,1.45,.64,1)`), a sliding hover bead under the links, solid orange CTA, X icon. **Depends on `id="top"`.**

### 6.3 Pinned scenes and their fallbacks
Every pinned scene is the same markup in all modes. CSS turns `.runway` into a tall box and `.pin` into a sticky 100vh frame only inside its media query. That is why phones and short screens get a normal stacked section for free.

### 6.4 01 · Yield split (`YieldSplitSection.tsx`, SVG)
A 1440 × 500 SVG timeline. A handle moves from *Today* to *Maturity*; the two branches (blue = locked, orange = floating) stretch and zip, and three summary cards appear at progress 0 / 0.3 / 0.7. Scroll is the single source of truth while pinned; drag, keyboard (←/→ ±5 %, Home/End) and the preset buttons all move the page scroll. Entrance choreography is pure CSS (`.zs-*`, delays through `--d`), replayed every time the frame re-enters. Pointer mapping uses `getScreenCTM()` so it is exact at any scale. Data comes from the featured market; only the simulation parameters are the demo's.

### 6.5 02 · Protocol economics (`ProtocolEconomics.tsx`)
A 70 / 30 allocation with a rail. Progress → two phases (`PROTOCOL_PHASE = [0.06, 0.42]`, `BURN_PHASE = [0.52, 0.88]`): blue fills 0→70 with a count-up, then orange fills 70→100 with a count-up, a glowing leading edge, a heat glow on the segment, a glow on the `30` and 12 embers rising off the rail. Totals count `0% → 100% allocated`. It states a **model only**: no revenue, burn totals, addresses or history. Non-pinned: autoplay once.

### 6.6 03 · Simulator (`StrategySection.tsx`)
Slider for the lending rate, capital presets, two cards (Fixed, Trading) with live-computed readouts and small SVG charts that react to the slider. Inputs come from the market and quotes; a labelled "Illustrative, not a quote" line keeps it honest.

### 6.7 04 · Markets (`MarketsPreview.tsx`)
A trimmed live table (most liquid featurable markets, `pickPreviewMarkets`), real icons through `AssetIcon`, a data-mode badge, honest loading / error / empty states.

### 6.8 05 · Open a position (`TradePreview.tsx`)
Pinned 3-step walkthrough (Strategy → Amount → Review) that mirrors the real trade flow, using the real quote hooks with a 350 ms debounce and the last good quote kept (dimmed) while the next loads. The Review step has a lending-rate switch showing *why* Fixed does not move while Trading does. The brief's risk sentence is verbatim.

### 6.9 06 · Portfolio simulation (`MaturityPreview.tsx`)
Static, illustrative: two position cards (Fixed, Trading) with a "claim" interaction. Flagged static by design.

### 6.10 Final CTA + footer (`FinalCTA.tsx`, `Footer.tsx`)
The fixed layer revealed by the curtain: an SVG Saturn, one headline, two buttons, a data-source footnote.

### 6.11 Contract-address pill (`ContractAddress.tsx`)
Glass pill at the hero's bottom-left. Click copies (Clipboard API, `execCommand` fallback) and shows "Copied to clipboard" for 1.8 s. The address is `useState(CONTRACT_ADDRESS)`. It measures the gap to the hero copy and fades out (and becomes `inert`) if it would sit closer than 8 px, so it can never cover a button.

---

## 7. Data and copy rules

1. **UI never invents data.** Names, APYs, maturities, liquidity and prices come from `useMarkets` / `useMarket` / `useFixedYieldQuote` / `useLongYieldQuote`. `featuredMarket.ts` only *chooses*: tradable, `daysRemaining > 0`, APYs within 0–100 %, liquidity > 0, **USDG / Global Dollar preferred**, then most liquid.
2. **Vocabulary:** user-facing **Fixed Yield** and **Trading Yield**. Internally `long` / YT (`strategy=long`, `kind: "long"`, `useLongYieldQuote`); never rename internals to match copy. PT/YT only as secondary information ("Powered by PT").
3. **Tone:** concise, premium, financial, trader-oriented. "Quoted", never "guaranteed" or "locked"; "exposure", never "leverage"; no hype.
4. **Claim safety:** no fake live numbers, no "verified onchain" badges unless real, labelled illustrations ("Illustrative", "Allocation model: shares, not live amounts").
5. **Copy lives in data where it can:** hero stage text in `heroStages.ts`, labels in constants at the top of each section.
6. **Wallet never required to explore:** previews and quotes work disconnected; the trade panel says "Connect wallet to execute".

---

## 8. Quality bar (checklist for every new section)

**Visual**
- Uses only tokens from §3; two accents max per section; no new gradient fills.
- Headline, eyebrow, body and metadata use the scale in §3.2.
- Aligned to the 1240 px container and the shared left edge.

**Motion**
- One state object; values derived from `progress` or eased toward goals.
- Entrance slower than exit; no layout-shifting hover.
- `prefers-reduced-motion`: final state shown, loops sleep, CSS animations off.

**Responsive**
- Pinned frame fits at 720, 768, 800, 900, 1080 px tall (measure `getBoundingClientRect().height`).
- 390 px: no horizontal overflow (`scrollWidth === innerWidth`), stack, readable.
- Touch: `touch-action: pan-y` on draggable canvases; targets ≥ 44 px.

**Accessibility**
- Decorative canvas/SVG `aria-hidden`; a real control (tabs, buttons) for anything the visual does.
- Animated numbers: visible digits `aria-hidden`, a screen-reader span with the final value.
- Visible focus rings (`focus-visible:outline-ice`); `role="img"` + `aria-label` on charts and rails; hidden-but-present UI uses `inert`.
- Icon-only links carry `aria-label`; external links `target="_blank" rel="noopener noreferrer"`.

**Performance**
- No per-frame DOM writes in canvas scenes; passive scroll listeners coalesced by `requestAnimationFrame`.
- IntersectionObserver for off-screen pause and for reveal; no scroll-position polling loops.
- Fonts: see A6.

**Honesty**
- Anything illustrative is labelled; nothing implies history that does not exist.

---

## 9. Playbook: building a landing like this in a new project

1. **Write the story first.** One sentence per screen. Decide which 3–4 moments earn a pinned scene; everything else is normal flow.
2. **Set tokens before components.** Background, foreground, muted ramp, two accents with fixed meanings, one sans + one mono. Put them in the Tailwind config *and* a constants file for canvas code.
3. **Build the shell:** container, eyebrow/headline/body styles, border and spacing rules, `.mono`, the global cursor rule, reduced-motion blocks.
4. **Build the scroll primitives once:** `useScrollProgress(runwayRef, query)` (the §4.1 recipe), `phase()`, `autoplay()` (§4.2) and `ScrollReveal`. Every scene reuses them. *(This repo repeats the recipe inside each component; extracting it is the first improvement to make, §10 A3.)*
5. **Do the hero as a state machine:** `stage` (discrete, hysteresis) plus `stagePos` (continuous), copy swap with staggered rise, one scene object. Start with a flat disc, add tilt/spin and the lattice, then rings (front/back halves), core, moons, stars, camera, emphasis, pins, interaction. The milestone list (M0–M10) with acceptance checks is in the 3D handoff.
6. **Add glass sparingly,** only where it floats over content (nav, one pill). Dark tint, rim light, specular arc; refraction only in Chromium.
7. **Wire data last, but design for it from the start:** build every section against a `useMarkets()`-shaped hook; write loading, error and empty states as real UI; keep illustrative widgets labelled.
8. **Verify with measurements** (§11), at the six sizes, with real mouse events, with reduced motion on.
9. **Write the handoff while you build** (constants, couplings, traps). Most of the traps in this repo cost an hour each the first time.

Reusable snippets:

```ts
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const phase   = (p: number, [a, b]: readonly [number, number]) => clamp01((p - a) / (b - a));
const decay   = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);          // frame-rate independent easing
// count-up that scrubs with scroll: value = Math.round(target * phase(progress, BEAT))
```

---

## 10. Audit (7 Oct 2026)

**Health:** `tsc` clean, `eslint` clean, `next build` OK, `bun test` **112 pass / 1 fail** (the failure is `deployments.test.ts`, registry names after the CLEAVE → YELTRA contract rename; owned by the logic side, not a design issue). Visual checks of every landing section passed at 1440 × 900, 1280 × 720 and 390 × 844.

**What is strong:** the scroll-scrubbed scenes and their fallbacks; the canvas hero (single loop, allocation-free, adaptive quality, reduced-motion aware); strict token discipline and colour semantics; honest copy; data decoupled from layout; the curtain/footer ending; extensive comments at every coupling.

| # | Sev | Finding | Where | Suggested action |
|---|---|---|---|---|
| A1 | M | **Contract-address pill is not production-ready.** The wrapper has `hidden`; `CONTRACT_ADDRESS = "fadfadfadfaf"` (dummy); `isLive` compares against `"dfadfadfadf"`, so with an empty address it is still `true`, copies an empty string and says "Copied". | `ContractAddress.tsx` L11, L61, L121 | real address, `isLive = contractAddress.trim() !== ""`, remove `hidden` |
| A2 | M | **17 invalid Tailwind opacity steps** (8/12/14/16/18): they render as bright grey borders. In `app/portfolio/page.tsx`, `EnvironmentStrip`, `MaturityPreview`, `app/docs/page.tsx`, `ConnectButton`, `YieldChart`, `PositionCard`, `MarketTable`, `MarketCard`, `Footer`, `DocsNavigator`, `app/markets/page.tsx`. | see list | replace by 10/15/20; add a CI grep so it cannot return |
| A3 | M | **Four pinned scenes, four different pin queries, and the recipe is copy-pasted.** Hero `≥1024w`, Trade `≥1024×700`, Economics `≥1024×720`, Split `≥1100×760`; each mirrors its query between CSS and JS by comment only. Between 700 and 760 px tall some scenes pin and others do not, which feels inconsistent. | `Hero.tsx`, `TradePreview.tsx`, `ProtocolEconomics.tsx`, `YieldSplitSection.tsx`, `globals.css` | one shared `PIN_QUERY` constant + `usePinnedProgress` hook; set the CSS query from the same value (or CSS variables) |
| A4 | M | **Hero fallback shows invented numbers** when no market is available: `6.42 %`, `$0.941`, `VAULT TVL $4.25M USDG`, `24H VOLUME $382.4K`. Breaks rule §7.1. | `heroStages.ts` L33–150 | neutral `—` values, keep the wording |
| A5 | L | **Pinned scroll length:** ≈ 12 screens before the simulator. Great on desktop, long for a visitor in a hurry. | §2.2 | consider shorter runways (e.g. 220–260vh) or a "skip to markets" anchor in the hero |
| A6 | L | **Fonts via CSS `@import` from Google.** Render-blocking, no `next/font`; `tailwind.config.ts` references `--font-geist-sans/-mono` variables that are never defined (the fallback `"Geist"` name is what works). | `globals.css` L1, `tailwind.config.ts` | `next/font` with `variable` set on `<html>`; or drop the unused variables |
| A7 | L | **Splash on every load** (≈ 2.2 s, `z-9999`) delays first meaningful paint of the hero. Skippable but not remembered. | `SplashScreen.tsx` | show once per session (`sessionStorage`) |
| A8 | L | **`HeroVisual.tsx` is one 1,684-line file with no unit tests.** Constants, painters, simulation and input are in the same module; the star generator was verified only with a one-off script. | `HeroVisual.tsx`, `heroStars.ts` | split into `palette.ts`, `camera.ts`, `painters/*`, `sim.ts`; unit-test `sampleCamera`, `smoothDamp`, `emphasisGoals` and the star generator |
| A9 | L | **Nav links duplicated** in `Navbar.tsx` and `FloatingNav.tsx`. | both | one `NAV_LINKS` constant |
| A10 | L | **Section numbers are hard-coded text** in six files. | each section | a small `<SectionEyebrow n={2} …>` or a constant list |
| A11 | L | **Illustrative sections are static** (`MaturityPreview` numbers such as 36.63 USDG, 6.38 %). They are labelled, but they are a place where a future reader may assume live data. | `MaturityPreview.tsx` | keep the label; mention in code comments |
| A12 | L | **`og-image.webp`** is a raster with the wordmark; any rename means regenerating it. (Currently shows YELTRA.) | `public/og-image.webp` | keep a source file next to it |

Accessibility spot-check: hero canvas `aria-hidden` with a real tablist; reduced motion handled in hero, split, economics, walkthrough, glass, reveal (11 media blocks in the CSS); `inert` on hidden overlays; focus rings present. Gaps: none blocking.

---

## 11. Verification recipes (no test framework needed)

Headless Chrome with `--remote-debugging-port`, driven through the DevTools protocol:

- `Page.navigate`, `Emulation.setDeviceMetricsOverride` (width, height, DPR, mobile), `Runtime.evaluate`, `Page.captureScreenshot`, `Input.dispatchMouseEvent` for **real** hover and click, `Emulation.setEmulatedMedia` with `prefers-reduced-motion`.
- The splash covers the first seconds; wait, then click the "Skip" button before measuring.
- **Pinned scene:** scroll to `top + travel × p` for `p = 0, .25, .45, .62, .75, 1` and read the DOM (counts, widths, `position` of the pin) at each.
- **Fit:** `getBoundingClientRect().height` of the frame vs `innerHeight` at 720, 768, 800, 900, 1080.
- **Overflow:** `document.documentElement.scrollWidth === innerWidth` at 390, 820, 1440.
- **Overlap:** compare the bottom of one element with the top of another (the CA pill vs the hero copy was checked this way for all five stages at six sizes).
- **Hero stages:** click `#hero-tab-0 … #hero-tab-4`, wait ~3 s for the camera to settle, screenshot.
- **Hydration:** load a page with a hash (`/docs#x`) and watch `Runtime.exceptionThrown` for "Hydration failed".
- **Colour tokens:** `next build && next start -p <port>`; a long-running `next dev` caches `tailwind.config.ts`.
- **Production check before any claim of "done":** `tsc --noEmit`, `eslint .`, `bun test`, `next build --webpack`.

---

## 12. Pitfalls (each cost real time)

1. **Tailwind `lg:` utilities beat your CSS** because they are emitted later; use an id prefix for overrides (§4.1).
2. **Invalid opacity steps** (8/12/14/16/18) silently become bright grey borders.
3. **Global `a:hover` colour** whitens button labels; give coloured buttons an explicit hover text colour.
4. **SVG filters:** no `<g>` inside `<filter>`; avoid `feBlend screen` for channel merges; match `HeadlessChrome/`.
5. **Fast Refresh keeps the canvas sim object;** new fields must be lazy or the loop throws and freezes until a hard reload. An already-open tab can keep an old effect closure, so hard-reload after editing the scene.
6. **Canvas gradients belong to the context;** rebuild them in `resize()`.
7. **Pointer capture** only after the drag threshold, otherwise taps on in-canvas buttons never fire.
8. **Hydration:** never read `window` in a `useState` initialiser (the docs navigator did, using the URL hash). Start with the server value and apply browser state in an effect.
9. **One `next dev` per folder;** to check a build on another port use `next build && next start -p <port>`.
10. **zsh:** quote globs (`--include='*.tsx'`); `timeout` does not exist on macOS by default.
11. **Stage count is coupled by index:** camera tables, pin positions, emphasis goals, pin styles, stage copy and the runway height (`55vh × stages`) must change together.
12. **A pinned frame taller than the viewport** clips with `align-items: center`; measure before shipping.

---

## 13. Quick reference

| I want to… | Go to |
|---|---|
| change a colour | `tailwind.config.ts` **and** the `rgb` constants in `HeroVisual.tsx` + hex in `heroStars.ts` |
| change the hero planet framing | `CAM_DESKTOP` in `HeroVisual.tsx` |
| change hero text | `heroStages.ts` (`FALLBACK_STAGES` and `buildStages`) |
| add a landing section | new component → `app/page.tsx` → renumber eyebrows; reuse §4.1 if pinned |
| change how long a scene is pinned | `.x-runway { height }` in `globals.css` (hero: `lg:min-h-[275vh]`) |
| add or restyle glass | `.lg-*` in `globals.css`; refraction in `liquidGlass.ts` |
| edit the contract address / X link | `ContractAddress.tsx` (`CONTRACT_ADDRESS`), `lib/site-links.ts` (`X_URL`) |
| understand the 3D math | `docs/HERO_3D_HANDOFF_2026-10-04.md` |
| project status, routes, env, ownership | `docs/HANDOFF_2026-10-04.md` |
| product behaviour (source of truth) | `docs/ROBINHOOD_YIELD_TRADING_MASTER_BRIEF_FINAL_V2.md` |
