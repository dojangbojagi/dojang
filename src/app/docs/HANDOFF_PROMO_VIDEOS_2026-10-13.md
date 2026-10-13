# GYEVO — promotional videos handoff (13 Oct 2026)

Written for the next engineer or agent picking up the **Remotion promo-video workspace** (`remotion/`). It
covers both the first build and the same-day rebuild after the PM rejected v1 as "screenshots with camera
moves." It does not touch, and does not require touching, anything under `src/`, `contracts/`, `circuits/` or
the wallet/Web3 code.

Everything here was verified against the working tree on 13 Oct 2026, rendering all three films end to end.

---

## 0. Read this first

1. **The Remotion workspace is fully isolated.** Its own `remotion.config.ts`, its own `remotion/` tree, its
   own `public/` (a byte copy of the real logo and fonts, not a symlink). It never imports from `src/`. Treat it
   as a separate mini-project that happens to live in this repo.
2. **Nothing in these three films is a screenshot or a screen recording.** v1 captured the real site/app with
   Playwright and panned/zoomed over the stills; the PM rejected that as a slideshow. v2 deleted the capture
   pipeline entirely and rebuilt every scene as genuine frame-animated Remotion components. If you're tempted to
   add a new screenshot-based scene, don't — re-read §2 and build it as a coded reconstruction instead, the way
   the existing scenes do.
3. **Never show a fabricated transaction, balance, rate, price or APY.** Anything that cannot be demonstrated
   for real (a generated proof, a DAO vote outcome) is drawn and explicitly labelled "Interface · reconstructed"
   / "· workflow illustration" / "not a live vote" — keep that labelling if you extend a scene.
4. **Keep the protocol relationships correct if you touch any copy or diagram:** a policy-4 credential reaches
   DAO governance directly, with **no** BOJAGI proof; a policy-3 credential needs a BOJAGI proof for Supply,
   Collateral and Borrow; Repay and Withdraw need **no** credential or proof at all — they are the protocol's
   fail-safe exits. Getting this backwards is the one mistake that would make these films actively misleading.

---

## 1. What the three films are

| Output (`out/videos/`) | Composition | Story |
|---|---|---|
| `gyevo-protocol.mp4` | `GyevoProtocol` | Cinematic brand film. A rotating wireframe lattice assembles into the logo; the problem ("eligibility usually means revealing the private value") stated in type against a value chip that seals itself; the same lattice sculpture turns from a fact, to a proof forming, to a verified check while it carries the three-line tagline; DOJANG/BOJAGI/DAO as three coded panels (a credential card, a device→boundary→verifier diagram, a ballot); two coded app tiles (DAO, Lending); the ending lockup over the lattice again. |
| `gyevo-trust-governance.mp4` | `GyevoGovernance` | Paper-white editorial motion graphics — already fully drawn in v1, so its structure is unchanged in v2. A credential bound to a wallet; policy 4 straight to DAO governance with no BOJAGI proof; policy 3 through a BOJAGI proof to Lending; a proof token leaving a device (now built from the same shared object as the other two films, for visual cohesion); a proposal lifecycle shown as a labelled workflow, not a live vote. |
| `gyevo-private-lending.mp4` | `GyevoLending` | Product film built from a coded reconstruction of the Lending V2 interface: a device frame with its own chrome, a coded wallet-select modal, a coded eligibility card with the witness drop (the drag animation was already coded in v1; only its screenshot backdrop was replaced), the proof-generation card (also already coded), a five-tile action dashboard. Cursor choreography and click ripples are kept. |

All three: 1920×1080, 30 fps, 32.000 s exactly, H.264 (yuv420p) + AAC 48 kHz stereo ~317 kbps. A cover `.jpg`
sits next to each MP4.

---

## 2. Architecture

```
remotion/
  index.ts, Root.tsx          entry and the three <Composition>s
  compositions/                Protocol.tsx, Governance.tsx, Lending.tsx
  lib/
    theme.ts, motion.ts         palette/fonts/fps + easing helpers (not new this pass)
    Brand.tsx                   Logo, Grain, Vignette, Ground, MaskLine, Mono, Disclosure, SitePill, Slats
    geo3d.ts                    NEW — plain 3D vector math: rotate/project points, no WebGL/three.js
    Sculpture.tsx                NEW — Lattice (a rotating wireframe icosahedron drawn from geo3d.ts, used as
                                  the recurring "fact / proof / verified" object in all three films) and
                                  GlyphField (a restrained hex-pair data texture, not decorative particles)
    ProofObjects.tsx             NEW — CredentialCard, ProofToken (blocks that assemble then arc across a
                                  boundary), VerifierBadge: shared credential/proof motifs, used by Protocol,
                                  Governance and Lending alike for one consistent visual identity
    cues.json                    per-film scene/hit/accent/riser/click timing, read by both the compositions
                                  and the audio synthesizer — the single timing source for picture and sound
    fonts.tsx                    loads the same Quicksand/JetBrains Mono woff2 as the site, via FontFace
  scripts/
    sync-assets.mjs              copies logo.svg + fonts + generates grain.png — NOT a capture tool, still legitimate
    synth-audio.py                rewritten this pass — see §4
  public/                        logo.svg, fonts/, grain.png, audio/ (generated, git-ignored)
remotion.config.ts                entry point, public dir, H.264/AAC codec settings
```

`lib/geo3d.ts`, `lib/Sculpture.tsx` and `lib/ProofObjects.tsx` are new this pass and are the right place to add
any new "technical object" or shared credential/proof motif — extend those rather than writing one-off geometry
inside a composition file.

### Per-composition notes

- **`Protocol.tsx`** — every scene rewritten. No more `staticFile("captures/...")` anywhere. `LogoScene` still
  opens with the slit/reveal mechanic from v1, now preceded by a `Lattice`+`GlyphField` build-up so the logo
  reads as condensing out of abstract geometry rather than appearing from nothing. `CommitmentProofScene` is one
  `Lattice` instance whose colour/radius/spin are interpolated across three states (fact → proof forming →
  verified) in sync with the existing three-line tagline timing — if you need to re-time the tagline, the hit
  times it's keyed to (`10.2`, `12.6`, `15.8`) are unchanged from v1's `cues.json`, so picture and audio stay in
  sync automatically.
- **`Lending.tsx`** — `Window` (the screenshot-mapping camera component) is gone, replaced by `DeviceFrame`: a
  coded app-chrome rectangle (`WIN = {x:660, y:140, w:1200, h:600}`) containing hand-built mockups per scene
  (wallet modal, eligibility card, action tiles). **If you resize `WIN`, re-check the ActionsScene caption row
  and the Hud's bottom disclosure/progress-bar line** — they collided once during this rebuild (fixed by
  shrinking `WIN.h` from 680 to 600 and nudging the caption's vertical offset); there's little vertical margin
  between the device frame's bottom and the Hud's bottom row.
- **`Governance.tsx`** — structure unchanged (it was already drawn, not captured, in v1). This pass: swapped
  the hand-rolled proof-token/checkmark markup for the shared `ProofToken`/`VerifierBadge` components, added a
  very faint `Lattice` behind the `Title` scene for cross-film visual cohesion, and fixed a label collision
  ("Boundary" was overlapping the scene's headline — moved from `top: 250` to `top: 272`).

---

## 3. Commands (Bun)

```sh
bun run video:studio            # Remotion Studio, all three compositions
bun run video:render            # all three MP4s plus the three covers
bun run video:render:protocol   # or one at a time
bun run video:render:governance
bun run video:render:lending
```

Rebuilding inputs (only needed if brand assets or the music change):

```sh
bun run video:sync    # logo.svg + fonts + grain tile, copied byte for byte
bun run video:audio   # the three soundtracks (python3 + numpy; deterministic, no samples)
```

There is **no capture step any more** — `video:capture` and `remotion/scripts/capture.mjs` were deleted this
pass along with `remotion/public/captures/` (47 MB). The films no longer depend on the live site being up at
render time at all.

**Concurrency:** each render script passes `--concurrency=2`. At the default concurrency, a full 960-frame
render stalled on this machine under memory pressure (visible as "Rendered N/960" stuck with no progress for
minutes, Chrome renderer processes pegged near-idle CPU); `--concurrency=2` rendered all three films cleanly in
a few minutes. If a render hangs, check free RAM before assuming a code bug, and drop to `--concurrency=1` if
`=2` still stalls. The first render of a fresh checkout also downloads Remotion's headless Chrome once.

Quick iteration tip: `remotion still remotion/index.ts <CompositionId> out.jpg --frame=<n>` renders a single
frame in a couple of seconds and is much faster than a full render for checking a layout change; a time-ranged
`remotion render ... --frames=0-300` preview is useful for checking the first few seconds of a new scene without
waiting for the full 32 s.

---

## 4. Audio

`remotion/scripts/synth-audio.py` generates every sound from sine waves, harmonics and filtered noise — no
samples, no third-party music, no AI-generated audio — so the result is original to this repository and has
nothing to license (CC0).

**This pass removed, on explicit PM rejection:** the FM bell "verification motif" (D5–A5–F6), the glassy bell
used at every node/accent, the dense 16th-note tick, and the plucked arpeggio loop. **Replacements**, all
non-melodic:

| Old | New | Purpose |
|---|---|---|
| `bell()` (FM bell triad) | `impact()` (a few inharmonic partials + a noise burst) | the "something happened" signature hit |
| plucked arpeggio (Governance) | `bass_pluck()` (filtered, damped saw) | a slow moving bassline under the pad — real harmonic motion without a melody |
| `tick()` (dense, had a 2.4 kHz sine partial) | `click_low()` (filtered noise only, no tonal partial) | sparse structural pulse, not a notification |
| `ui_click()` (had two sine partials ~1.8 kHz/925 Hz) | `ui_tap()` (low thump + dry noise) | cursor-click sound in Lending, now reads as a tactile tap, not a notification ding |

The shared identity across all three films is now textural rather than melodic: a D-minor pad/drone palette and
one `impact()` family, run through one shared reverb. Each film also gets one deliberate `silence_pocket()` — a
dip toward near-silence in the second or so before its final impact — a genuine quiet beat, not an accident.
Scene/hit/accent/riser/click timing for both picture and sound comes from `lib/cues.json`.

**Licensing honesty:** no commercially licensed instrumental track was available in this environment (no way to
source or verify a license for anything pulled from the open web). Per the brief's own fallback instruction,
this ships a newly composed original synthesized score rather than silence or the previous bell-based one. If a
properly licensed track becomes available later, drop it in as `public/audio/gyevo-<name>.wav` (44.1 kHz
stereo) — nothing else needs to change.

---

## 5. What is authentic vs. drawn

- **Authentic:** `public/logo.svg` (byte copy, never modified), Quicksand/JetBrains Mono (same files as the
  site, from `src/app/fonts`), the palette, and the copy's factual claims about the protocol.
- **A coded reconstruction, not a capture, but not pretending to be a literal screenshot either:** every
  "interface" moment (wallet modal, eligibility card, witness drop, proof card, action tiles, DAO/Lending app
  tiles) — each carries an "Interface · reconstructed" or "· workflow illustration" tag wherever the state is
  simulated.
- **Drawn and labelled:** the credential object, the proof leaving a device, the DAO lifecycle ("Workflow
  visualization · not a live vote"), the rotating lattice standing in for a fact/proof/verified credential.
- **Never shown:** transaction hashes, receipts, balances, rates, prices, APYs, or a connected real wallet.

---

## 6. Dependency note: Remotion vs. Zod

`npx remotion versions` reports the root `zod@3.25.76` (used by `src/lib/credential/witness.ts` and the env
config) as a mismatch against `@remotion/zod-types`' expected `zod@4.5.4`. **This is cosmetic, not a bug:**
nothing under `remotion/` imports `zod` or `@remotion/zod-types` (no `zColor`/schema-validated composition
props are used), `@remotion/cli` itself resolves the hoisted root `zod@3.25.76` at runtime (verified with
`node -e "require.resolve('zod', {paths:[...]})"` from inside `@remotion/cli`'s own directory — same file both
ways), and all three films render and play back correctly. The root `zod` version was deliberately **not**
forced to 4.x, because `src/lib/credential/witness.ts` depends on the 3.x API. Don't "fix" this by running
`npx remotion add zod` — it would silently break application code outside this workspace.

---

## 7. Verification checklist

```sh
bun run typecheck                       # must be 0 errors — remotion/ is included in the TS project
bun run video:render                    # renders all three + covers, ~2–3 minutes with --concurrency=2
```

What was checked this pass, and how, for anyone reproducing it:
- **Stream specs** via the bundled ffprobe (`node_modules/@remotion/compositor-darwin-arm64/ffprobe`, needs
  `DYLD_LIBRARY_PATH` set to that directory on macOS): 1920×1080, 30 fps, h264/yuv420p, aac/48000/stereo, exactly
  32.000 s for all three.
- **Audio cleanliness**: decoded each MP4's audio track to PCM and measured peak/RMS/clipped-sample count in
  numpy — all three around −1.0 to −1.16 dBFS peak, no clipped samples.
- **Visual correctness**: pulled frames at six timestamps per film directly from the rendered MP4s (not from a
  preview render) and inspected them — this is how the two layout collisions in §2 were caught. Do this again
  after any layout change; a still render only shows you one frame, a full render can introduce timing bugs a
  still won't.

---

## 8. Known limitations

- No licensed commercial music track (see §4) — purely synthesized, documented as such.
- The lending-cover frame (`--frame=66`, mid-way through the Opening scene's text slam) is a deliberately
  dynamic mid-motion shot with a light-sweep still passing through; it was kept because it reads as an
  intentional title card, not reviewed as a bug.
- Audio was validated numerically (peak/RMS/clipping), not by ear — listen to all three once before using them
  publicly.
- `remotion/public/audio/*.wav` are git-ignored and regenerated by `bun run video:audio`; `out/` was already
  git-ignored. A fresh checkout needs `bun run video:sync && bun run video:audio` before the first render if
  those generated files aren't present.

**Why this pass happened:** the first cut was rejected as a screenshot slideshow with camera moves; the brief
asked for genuinely frame-animated, premium Remotion compositions and a redesigned, non-bell soundtrack, with
the real site kept only as a design reference, not as footage.
