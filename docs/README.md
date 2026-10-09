# Private Verifiable State: HTML prototype

A static, clickable prototype of the six-page product described in the master development brief. It is meant to be judged by eye and by hand, then migrated to Next.js.

**Status**

| Page | File | Status |
| --- | --- | --- |
| Home | `01-home.html` | Complete |
| Dojang | `02-dojang.html` | Placeholder: header, footer, plan, planned states, live state readout |
| Bojagi | `03-bojagi.html` | Placeholder |
| Vault | `04-vault.html` | Placeholder |
| Contracts | `05-contracts.html` | Placeholder |
| Docs | `06-docs.html` | Placeholder |

Nothing here talks to a blockchain. Every wallet, credential, proof and transaction state is **simulated** and labelled that way on screen.

---

## 1. Open it

- **Fastest:** double-click `01-home.html`. Every page works from `file://`. Scripts are classic scripts on purpose, because ES modules do not load from `file://`.
- **Static server (optional):** `npx serve .` or `python3 -m http.server`, then open `/01-home.html`.
- No build step, no package install.

## 2. Folder structure

```
prototype/
  01-home.html … 06-docs.html
  README.md
  assets/
    css/
      styles.css       entry point, only @imports the files below
      fonts.css        @font-face for the three self-hosted families
      tokens.css       every colour, size, radius, shadow and timing value
      base.css         reset, typography, layout primitives, ambient background
      components.css   shared components (header, footer, buttons, status chips,
                       panels, modal, toast, tooltip, switcher, skeleton, stub layout)
      home.css         Home-only sections
    js/
      app.js           shared: simulated state, header/footer, modal, toast,
                       tooltips, scenario switcher, section tone, in-view
      home.js          Home-only: proof path, how-it-works, eligibility demo, vault gate
      stub.js          placeholder pages: planned-state chips and live readout
    fonts/             woff2 files (all SIL Open Font License)
    images/veil.svg    the patchwork cloth tile
```

Load order on every page: `app.js` first, then the page script. Both are `defer`.

## 3. Design direction

- **Idea:** Dojang is a seal, Bojagi is a patchwork cloth. Official facts are *sealed*. Private facts are *wrapped* in cloth. The cloth tile (`veil.svg`) appears wherever something is hidden.
- **Colour follows the proof path.**
  - Celadon = trusted state (Dojang)
  - Periwinkle = private proof (Bojagi-inspired)
  - Gold = verified execution (Vault) and primary actions
- **Surfaces:** deep indigo, not black. One fixed ambient glow changes colour as sections scroll into view.
- **Type:** Instrument Serif for display, Hanken Grotesk for text, JetBrains Mono for addresses and code.
- **The landing in two phases.** Phase 1 is the sentence *Prove more. ⬚ Reveal less.* with a small cloth square sitting in the gap: the sealed thing, inside the claim. Scrolling opens that square until it fills the screen, and phase 2 (the hero) is what was inside it all along. The scroll takes about 1.2 screens, so the page explains itself quickly.
- **The hero reacts to the pointer.** Behind the copy is a field of hex characters, the public data. Wherever the pointer goes, a patch of bojagi cloth settles over it and lifts again slowly. That one gesture is the product: the data is there, you simply do not have to show it. On touch devices the patch drifts on its own; under reduced motion the field is drawn once and left still.
- **Signature visual:** the *proof path*, a two-lane diagram (public above, private below) with a payload that crosses the boundary three times. On narrow screens it rebuilds as a stacked version.
- **No partner logos.** Where a marketing site would run a row of backers, this one runs the plain facts on a loop: testnet, not audited, no funds held.
- **Shape language:** square technical panels (3px), small controls (8px), pill status chips. Seams are drawn as dashed lines.

## 4. Design tokens and Tailwind mapping

All values live in `assets/css/tokens.css`. Nothing else hard-codes a colour.

| Token group | CSS variables | Suggested Tailwind key |
| --- | --- | --- |
| Surfaces | `--ink-1000` … `--ink-600` | `colors.ink.{1000,950,900,850,800,700,600}` |
| Text | `--text`, `--text-muted`, `--text-dim` | `colors.text.{DEFAULT,muted,dim}` |
| Protocol | `--celadon`, `--periwinkle`, `--gold` (+ `-deep`) | `colors.celadon`, `colors.periwinkle`, `colors.gold` |
| State | `--state-valid/pending/invalid/warn/demo` | `colors.state.*` |
| Lines | `--line-faint`, `--line`, `--line-strong` | `borderColor.line.*` |
| Fonts | `--font-display/ui/mono` | `fontFamily.display/ui/mono` |
| Type scale | `--fs-display` … `--fs-xs` (fluid `clamp()`) | `fontSize.*` |
| Spacing | `--space-1` … `--space-10`, `--section-pad`, `--gutter` | `spacing.*` |
| Radius | `--radius-xs/sm/md/pill` | `borderRadius.*` |
| Motion | `--ease-out`, `--dur-fast/med/slow/scene` | `transitionTimingFunction`, `transitionDuration` |
| Layers | `--z-header` … `--z-tooltip` | `zIndex.*` |

Notes for migration:
- `--glow` is a registered custom property (`@property`). The page tone transition depends on it. Keep it in global CSS.
- Text contrast (measured): `--text` is 11:1 or better and `--text-muted` is 6:1 or better on every surface. `--text-dim` passes AA only on the three darkest surfaces (4.8 to 5.4:1), so it is used for secondary notes and empty placeholders, never on `--ink-800` or lighter.

## 5. State model and the scenario switcher

State lives in `Proto.state` (in `app.js`). It is the simulated stand-in for the real `ProtoState` that wallet, chain reads and transactions will feed later.

```
wallet           disconnected | connecting | connected | wrong-network
dojang           idle | checking | official-verified | no-official-credential
                 | expired | revoked | read-error
demoCredential   true | false            (kept separate from dojang on purpose)
proof            credential-required | ready-to-prove | generating | generated
                 | invalid | ready-to-submit
tx               idle | awaiting-signature | submitted | confirming | confirmed
                 | reverted | rejected | rpc-error
vault            locked | eligible | access-granted | previously-granted
```

Label text follows section 10 of the master brief exactly. Use `Proto.state.chip(kind, value)` to render a chip with the right label and tone.

**Scenario switcher** (bottom left, "Scenarios", also reachable from the top bar). Eight previews:
`Disconnected`, `Verified`, `Unverified`, `Proof pending`, `Proof valid`, `Proof invalid`, `Vault locked`, `Vault access granted`.

- Picking a scenario shows skeletons for about 0.65 s, then updates every subscribed component.
- The choice is kept in `sessionStorage`, so it follows you from page to page. If storage is unavailable the prototype still works.
- The switcher is a **dev-only** control. Remove `renderScenarioSwitcher` (and the top bar) for production.

Useful calls from the browser console:

```js
Proto.state.apply('proof-valid')
Proto.state.patch({ tx: 'reverted' })
Proto.toast('Saved', 'valid')
```

## 6. Shared behaviours

- **Cover transition** (`initCover` in `home.js`). It writes one number, `--p` (0 to 1), plus the four clip insets of the opening, onto the stage element; all the motion is CSS reading those. It is skipped entirely under reduced motion and without JavaScript, where the two phases simply stack. The hero's links stay out of the tab order until the opening is more than half done.
- **Pointer field** (`initField` in `home.js`). One canvas. The characters are drawn once to an offscreen canvas and blitted each frame; only the cells under the pointer are painted on top, and the loop stops when nothing is moving or the hero scrolls out of view.
- **Header and footer** are rendered from `data-component` placeholders. Set `data-active="home|dojang|bojagi|vault|contracts|docs"` on the header. Past 40px of scroll the header gets `data-scrolled="true"` and the navigation collapses into a floating pill.
- **Wallet button** shows the full label on desktop and a short label on phones. The full label stays as the accessible name.
- **Modal:** native `<dialog>` (focus trap and Escape for free). **Toast:** polite live region.
- **Glossary tooltips:** `<button class="term" data-tip="…">word</button>`. They open on hover, focus and tap.
- **Page tone:** any element with `data-tone="neutral|dojang|bojagi|vault"` changes the ambient glow while it is in view.
- **Reduced motion:** all animation is shortened to near zero, the proof path stops, and the eligibility demo jumps to its result.
- **Keyboard:** skip link first, visible gold focus ring, proof-path nodes and how-it-works tabs are operable by keyboard (arrow keys on tabs).

## 7. Component boundaries for Next.js

Each name below is a suggested React component and where its prototype code lives today.

| Component | Prototype source | Props / state it will need |
| --- | --- | --- |
| `ProtoBar` (dev only) | `renderProtoBar` | none |
| `SiteHeader` | `renderHeader` | `active` |
| `NetworkIndicator` | `netPill` | chain, kind |
| `WalletStatus` | wallet button + `openWalletModal` | wallet state, connect / switch actions |
| `SiteFooter` | `renderFooter` | none |
| `CoverReveal` | `home.js` `initCover` + `.cover` | scroll progress; disable flag |
| `DataField` | `home.js` `initField` + `<canvas class="field">` | density, palette, reduced-motion flag |
| `ProtocolHero` | Home `.hero` | none |
| `FactTicker` | Home `.hero__foot` | list of statements |
| `ProtocolArchitecture` | Home `#how` (tabs + `.how-svg`) | step |
| `ProofPath` | `home.js` `ProofPath` | stage data, layout |
| `EligibilityDemo` | Home `#showcase` | policy, phase |
| `CredentialOverview` | Home `#systems`, future `/dojang` | credential, source (official or demo) |
| `AttestationDetails` | future `/dojang` | issuer, UID, dates, revoked |
| `EligibilityPolicySelector` | future `/bojagi` | policy list |
| `ProofGenerationPanel` | future `/bojagi` | proof state |
| `ProofVerificationStatus` | future `/bojagi`, `/vault` | proof, tx |
| `VaultAccessPanel` | Home `.gate` (preview), future `/vault` | vault state |
| `TransactionEvidence` | future `/vault`, `/contracts` | tx hash, status |
| `ContractExplorer` | Home `.chain` (preview), future `/contracts` | contract list, deployment status |
| `DocsSidebar` | future `/docs` | sections |
| Primitives | `.btn`, `.status`, `.panel`, `.kv`, `.callout`, `.slot`, `.seg`, `.modal`, `.toast`, `.tooltip`, `.skeleton` | variants |

Migration tips:
- Replace `Proto.state` with a store (Zustand or context) fed by wagmi/viem and real reads. Keep the value names above so the labels do not change.
- The `data-*` hooks (`data-step`, `data-on`, `data-gate`, `data-phase`) map cleanly to props.
- The proof path and architecture diagram are generated from plain data objects (`STAGES`, `LAYOUTS`, `HOW`). Move those to typed constants.
- Move `tokens.css` into `globals.css` first. Then map to `tailwind.config.ts` using the table in section 4.
- Self-hosted fonts: use `next/font/local` with the same files.

## 8. Honesty rules built into the UI

- No invented addresses, transaction hashes, balances, TVL, APY or activity. Contracts say **Not deployed yet**.
- "Official GIWA" and "Project contract" are always visually distinct. A demo credential is never shown as official verification.
- The demo threshold reads "1,000 verified test units", not a dollar amount.
- An illustration never claims a proof was generated. The Home demo says so.
- A green state is never shown as proof of execution. The vault gate states that doors open only after a confirmed on-chain transaction.

## 9. Known limitations

- Pages 02 to 06 are placeholders. They show the plan, the planned state chips and a live state readout, not the final design.
- All behaviour is simulated. There is no wallet, no chain read, no proof.
- Glossary tooltips and the scenario switcher are prototype tools, not final UX.
- The architecture diagram scrolls sideways inside its frame on phones, to keep the text readable.
- While the cover is still closed, the hero's two buttons are not in the tab order. The same destinations are in the navigation, and reduced-motion users get the hero immediately.
- The cover needs `clip-path`. Browsers without it fall back to the stacked layout.
- Tested in Chromium (desktop 1440, tablet 768, phone 390 / 360 / 320). Safari and Firefox are not yet checked.
- `@property` and `color-mix()` need a current browser. Older browsers lose the animated ambient colour and some tints.
- Project name is a placeholder (`CONFIG.brand.name` in `app.js`).
