# GYEVO — landing & app-shell redesign handoff (13 Oct 2026)

Written for the next engineer or agent (Codex, a new developer, or a fresh Claude session) picking up **landing
page, hero, navigation and inner-page presentation** work. It is the entry point for everything that changed on
the public site between 9 and 13 October 2026. It does not cover Lending/DAO contract logic, hooks, circuits or
deployment — those are owned separately (see "Ownership and boundaries" below).

Everything here was verified against the working tree as it stood on 13 Oct 2026. The repo is worked on
concurrently by more than one agent; **re-read a file before editing it**, and diff against recent commits
rather than assuming the tree is exactly as this document describes.

---

## 0. Read this first

1. **Scope discipline.** Every pass in this project was requested narrowly ("jangan ubah apapun, fokus ke yang
   gw mention" — don't change anything else, focus only on what was mentioned). Do the same: touch only what
   you were asked to, leave `providers.tsx`, `lib/*`, contracts, circuits and the Lending/DAO hooks alone, and
   report in plain language what files changed and why.
2. **Performance is a hard requirement.** The hero renders two animated canvases (the glyph field and the
   cipher-sculpture transition). Rules that keep it at 60 fps: never draw to a canvas while the page is
   scrolling except the scroll-driven ones; animate only `transform`/`opacity` for anything infinite; no
   `shadowBlur`, no large blurred `box-shadow`/`backdrop-filter` on elements that resize with scroll; write a
   CSS custom property only when its value actually changes. Re-measure with a Chrome performance trace after
   touching `cover-reveal.tsx`, `glyph-field.tsx` or `cipher-sculpture.ts`.
3. **Scroll state is CSS custom properties, not timers.** The whole hero is driven by `--e`, `--c`, `--h`,
   `--k`, `--q`, `--s` written onto the stage element by JS as the user scrolls (see §2). Never reintroduce a
   `setInterval`/`requestAnimationFrame`-driven animation independent of scroll position for anything in this
   system.
4. **The brand name is `appEnv.appName`**, not a literal string. It currently resolves to "GYEVO" from
   `.env`/`NEXT_PUBLIC_APP_NAME`, but some older copy or asset names still say "Bojogay" (the project's earlier
   name) — don't be surprised by it, and don't hardcode either name into new copy.
5. **Product copy stays honest.** No partner logos, no invented metrics. Project credentials are explicitly
   *not* official GIWA/Dojang/Upbit credentials, and the site says so wherever it matters (footer, Trust-layer
   copy, disclosures). Robinhood Testnet is the only network actually live; GIWA Sepolia references are legacy.

---

## 1. Visual identity (final state)

Palette is **black / burgundy / white** (PM-approved reference card), landed after several earlier palettes
(vivid blue+orange, then ice-blue+lime, then cream+lime) were all explicitly rejected — **do not reintroduce
blue, cyan, lime or purple.**

| Role | Token | Value |
|---|---|---|
| Ground | `--lp-ink` / `theme` ink | `#060405` (surfaces `#0E0A0C`, `#150F12`) — a breath of wine, never navy |
| Text | — | `#F7F3F4` (muted `#A89DA1`, dim `#857A7E`) |
| Public / on-chain / trusted | white | DOJANG, DAO |
| Private / the proof / primary actions | burgundy fill | `#9A1637 → #6D001A → #4F0012`, **white** label |
| Burgundy's lit twin (text, lines, dots, glyphs) | wine red | `#B81A34` (NOT the earlier pink-ish ruby `#E0405F` — rejected as "pink and ugly") |

Rule that must hold: **small text is never wine red — it stays white.** Wine only colours borders, dots, fills
and large display words. Status colours are functional and intentionally off-palette: valid = white, pending =
pale rose, warn = amber, invalid = red, demo = warm grey.

Font is **Quicksand** (SIL OFL 1.1, static weights 400–700, run through `fontTools.removeOverlaps` and renamed
"Bojogay Sans" to fix overlapping contours in the outlined footer wordmark — see
`src/app/fonts/QUICKSAND-OFL.txt`) for both display and UI text, chosen after Pretendard was rejected as "too
conventional" — it is giwa.io's *body* font, not their proprietary headline face (GiwaSans), which was never
bundled or derived from. JetBrains Mono stays for labels/addresses/hashes/code. `next/font/local` needs literal
options inline — `tsc` will not catch a violation, only `next build` will.

---

## 2. The hero system

Entry: `src/components/landing/landing-page.tsx`. All CSS is scoped under `.lp` in `landing.css`. The whole
opening is one scroll-driven runway (`--lp-run: 337svh`) on a sticky stage, controlled by
`src/components/landing/cover-reveal.tsx`, which writes these custom properties every frame (never on a timer):

| Variable | Meaning |
|---|---|
| `--e` | 0→1 across the opening (`OPEN 0.4165` of the run) |
| `--h` | hold progress once the opening has finished (`HOLD 0.211` of the run) |
| `--c` | the camera push-in after the hold |
| `--k` | 0→1 across a second `100svh` extension (`SHOW_RUN`) added *between* the hold and the push-in, for forms C/D |
| `--q` | the original knot→gyro blend, a pure function of `--h` |
| `--s` | 0..3, how many of the four hero-text changes are done (drives the overlay copy, see §2.3) |

**Keep `SHOW_RUN` (100svh) and `--lp-run` (337svh = 237 + 100) in step** if you ever touch the runway length.

### 2.1 The opening transition — `cipher-sculpture.ts`
The white→dark cover transition is a canvas-2D "cipher sculpture": 9 folded plates that start packed as a cube
and fan out left-to-right, each plate split on a vertical ridge into two hinged halves, yawed/rolled/lifted,
settling as flat strips. It replaced an earlier "swelling dot" design the owner felt looked too much like a
GIWA motif. It is driven purely by `--e` (`v = e^0.62`), so it runs identically in reverse on scroll-up, and at
`e≈0`/`e≈1` it returns `null` so `cover-reveal.tsx` falls back to its original `inset(...)` clip — the first and
last frame are pixel-identical to the pre-cipher build. `--clip` is the CSS `path()` union of the plates'
projected faces. Change the look only inside `makeBlades`/the per-blade block in this file; never re-tie the
scroll length to it.

### 2.2 The hero picture — `glyph-field.tsx` + `hero-forms.ts`
One 1320-hex-character 3D point cloud on a canvas (`.lp-form`), morphing through **four forms** as the user
scrolls, each a pure function of position/time over the same shared point set:

| Form | Where it lives | Look |
|---|---|---|
| A — Knot | `glyph-field.tsx` (untouched since the palette pass) | trefoil tube, white/silver with wine flecks, at rest |
| B — Gyro | `glyph-field.tsx` (untouched) | three tilting rings + a core, blended from A by `--h` (`H_FROM .22 → H_TO .90`) |
| C — Proof lattice | `hero-forms.ts` → `buildLattice` | 10-vertex skewed crystal, nested half-size cell, octahedral core counter-turning, silver shell / wine inside |
| D — Access topology | `hero-forms.ts` → `buildTopology` | hand-composed kinetic tower: three stacked slabs on corner posts around a lit core tube, branching bridges, junction cubes (redone once after the first version read as "too noisy and flat") |

B→C and C→D blend across `--k` (`.14–.38` and `.58–.82` respectively, each resting outside those windows),
points paired by azimuth/height exactly like A→B. Mouse drag turns the form (desktop only; touch scrolling is
never intercepted); reduced motion renders form A once, statically.

### 2.3 Hero copy follows the forms
`cover-reveal.tsx`'s `--s` (0..3) drives three overlay text blocks (`data-story-i="1|2|3"`) that cross-fade in
sync with each form change — the original two-line headline/lede is untouched and still sizes the layout; the
overlays fade out/in around it. Copy currently: *"Dojang. / Access with proof."*, *"Prove the rule. / Not the
value."*, *"One protocol. / Two ways to act."* Reduced motion shows only the original text.

---

## 3. Navigation and the app shell

The site is split into a **public surface** (marketing: `/`, `/dojang`, `/bojagi`) and an **app surface**
(`/app` and everything behind it) — this was a PM-driven restructure, not a cosmetic one.

- **Public bar** (`landing-nav.tsx` on `/`, `site-header.tsx` on `/dojang`/`/bojagi`): logo, three direct
  anchor links **DOJANG · BOJAGI · DAO** (scroll-spy'd, hash-arrival aware), and **Launch App** → `/app`. No
  wallet button here. (An earlier "Features" dropdown menu, `features-menu.*`, was built, then deleted in favour
  of the three direct links — don't resurrect it without checking with the PM first.)
- **App bar**: every other non-landing route (`/app`, `/lending`, `/dao`, `/docs`, `/contracts`) gets App ·
  Lending · DAO · Docs · Contracts · "← Website" · network pill · `WalletControl`. `SiteHeader` picks the bar by
  route, not by a prop you set per page.
- **`/app`** (`src/app/app/page.tsx` + `app-home.css`) is the hub: it lists Lending/DAO/Docs/Contracts and
  carries `WalletNetworkCard`.
- **Vault is retired.** `/vault` is `redirect("/app")`. Every vault link was removed from headers, footers,
  landing, pagers and the bojagi/dao panels. The Vault route, component and contracts themselves were **not**
  touched — only links to it.
- **The pinned DOJANG/BOJAGI/DAO story** (`feature-story.tsx`) is one sticky scene (runway `100svh + 3×85svh`,
  deterministic `sceneAt(u)`) that is the single source of truth for "which feature is active" — the nav and
  the URL hash both read from it, not the other way around. Below 900px wide / 640px tall, or under reduced
  motion, it falls back to stacked static blocks. `LendingSection` follows as a normal (non-pinned) section.

---

## 4. Inner pages touched in this pass

- **`/docs`** (this folder: `page.tsx`, `docs-toc.tsx`, `docs.css`) was rewritten as plain customer-facing
  documentation — no repo paths, env variable names or internal test counts. The contents rail (`DocsToc`) is a
  scroll-spy: the active section is the *last* one whose top has passed the reading line (sticky header height +
  section `scroll-margin-top`), the last section is forced active at the very bottom of the page even if it's
  too short to reach the line, and a click holds its own highlight until the smooth scroll settles so it
  doesn't flicker through sections it passes over. Mobile collapses the rail into a horizontal sticky chip bar.
  The overview figure (`.docs__arch*`) is a two-branch diagram: policy 4 → DAO directly (no proof), policy 3 →
  BOJAGI → Lending V2 (needs a proof) — keep this relationship correct if you ever touch it; it is the one fact
  this whole product is built to demonstrate.
- **`/contracts`** gained a viewing-only network selector (`contract-directory.tsx`): Robinhood Testnet is
  active, Mainnet (4663) is shown disabled. It lists all ten deployed contracts with a live
  Deployed/Source-Not-Verified status per address — addresses match `docs/ROBINHOOD_TESTNET_DEMO.md`.
- **Lending V2 eligibility** (`src/components/lending-v2/v2-witness-upload.tsx`) got a custom drag-and-drop
  zone over a real, visually-hidden `<input type="file">` — presentation only; the actual witness
  parsing/validation in `v2-eligibility.tsx` was not touched. The older V1 (`borrow-view.tsx`) and DOJANG
  (`credential-witness-importer.tsx`) file inputs are still the plain native control; don't assume they match.

---

## 5. Ownership and boundaries

`docs/FRONTEND_INTEGRATION_HANDOFF.md` is the authoritative interface contract between presentation and logic.
In short: **Codex owns** `src/lib/*`, `src/hooks`, `contracts/`, `circuits/`; **presentation work** (this
handoff's scope) may change page markup and CSS but must keep route names, `providers.tsx` and hook contracts
stable. `package.json`/`bun.lock` are shared — say so explicitly any time a UI change adds a dependency (e.g.
`lenis` for the landing's smooth scroll was one such addition).

Known cross-cutting gotchas, still true as of this pass:
- The dev server runs on **port 3001** (3000 is a different, unrelated project on this machine).
- Do **not** run `bun run build` in the live project while `next dev` is up — it holds the build lock. Clone to
  a scratch directory (`cp -cR` for an instant copy-on-write clone on APFS) to verify a production build.
- `useDaoGovernance(proposalId)` puts a raw `bigint` into a React Query key, which cannot be serialized — a
  known Codex-side bug, not something to "fix" from the presentation layer; the DAO page works around it by not
  passing an ID and reading one proposal through the feed instead.

---

## 6. Verification checklist

```sh
bun run typecheck   # must be 0 errors
bun run build       # or build a scratch clone if next dev is running
```

No ESLint config or test runner is wired up for the frontend; a Chrome performance trace (headless, retina) is
the only way to confirm the hero still holds 60 fps — compare against: idle main thread ≈2%, ~16.7 ms/frame
through the whole scroll runway. There is no automated regression test for the scroll math; verify by comparing
`--e/--c/--h/--k/--q` at a fixed set of scroll positions against a before/after trace if you touch
`cover-reveal.tsx`.

---

## 7. Where the detail lives

This document is the index. Deeper, narrower handoffs exist for specific systems and are kept up to date when
their subject changes — read the relevant one before touching that system:

| Doc | Covers |
|---|---|
| `docs/handoffburgendy.md` | Current look entry point: palette rules, the `--h` hold, the two-side hero layout |
| `docs/HANDOFF_HERO_3D.md` | The hero forms' math, with a tested single-file demo |
| `docs/HANDOFF_FRONTEND.md` | Stack-independent rebuild guide (tokens, scroll formulas, components) — some tokens are stale (see below) |
| `docs/GLYPH_SOLID_3D_HANDOFF.md` | The `GlyphSolid` 3D point-cloud technique used on `/vault /contracts /docs`-style page figures |
| `docs/FRONTEND_INTEGRATION_HANDOFF.md` | The presentation/logic ownership contract |

**Known-stale on purpose:** `docs/HANDOFF_FRONTEND.md` and `docs/GLYPH_SOLID_3D_HANDOFF.md` still describe an
earlier palette (navy/blue/orange tokens, old scroll constants) — they were not rewritten because the owner
asked each pass to touch only what was requested. Offer to refresh them if you're already deep in that area,
but don't block other work on it.

**Why this pass happened:** the product needed the first ten seconds to say what GYEVO is with a premium,
giwa.io-adjacent feel but a legally and visually independent identity, then needed its navigation to put the
two technologies (DOJANG, BOJAGI) front and center on the public site while keeping the working product behind
a single "Launch App" door.
