# GYEVO promotional films

Three standalone, 1920 × 1080, 30 fps Remotion films. The compositions render animated SVG and typography directly; they use no screenshot footage and have no runtime imports from the Next.js app, wallet, contracts, or circuits.

| Output | Length | Direction |
| --- | ---: | --- |
| out/videos/gyevo-protocol.mp4 | 24 s | A frame-filling cryptographic slab forms, closes into a sealed commitment, sends only a proof across a light boundary, then branches to direct DAO and BOJAGI-gated Lending. |
| out/videos/gyevo-trust-governance.mp4 | 26 s | High-contrast kinetic editorial typography and credential seals lead into public DAO participation, Policy 04 → DAO, and Policy 03 → private BOJAGI eligibility → Lending. |
| out/videos/gyevo-private-lending.mp4 | 26 s | Separate animated mechanisms show private eligibility, liquidity supply, collateral bounds, borrowing, repayment and collateral release. Transaction and position visibility is public; eligibility stays private. |

The lending visuals are mechanism illustrations. They show no fake balance, rate, APY, price, transaction result, or live proof. The governance film shows process stages without presenting vote results. `out/videos/promo-evidence/` contains inspected opening, middle and ending frames for all three films.

## Render

Run these commands from the repository root:

- node_modules/.bin/remotion render remotion/index.ts GyevoProtocol out/videos/gyevo-protocol.mp4 --concurrency=2
- node_modules/.bin/remotion render remotion/index.ts GyevoGovernance out/videos/gyevo-trust-governance.mp4 --concurrency=2
- node_modules/.bin/remotion render remotion/index.ts GyevoLending out/videos/gyevo-private-lending.mp4 --concurrency=2

The current music is from licensed existing Mixkit tracks, not the repository’s generated WAV scores. Track sources, license limits, and the outstanding need for a human listening check are documented in [AUDIO-LICENSES.md](./AUDIO-LICENSES.md). Do not run video:audio for these films; it regenerates the unused synthetic tracks.

The films use the copied official mark, Quicksand and JetBrains Mono, and the site palette. Each film has its own visual identity. The closing disclosure identifies the Robinhood testnet, test tokens, audit status, and independence from GIWA and Upbit.

## Source layout

- index.ts and Root.tsx: composition entry
- compositions/: Protocol.tsx, Governance.tsx, Lending.tsx
- lib/: brand assets, fonts, theme, cues and motion helpers
- public/: copied logo, fonts, grain, and selected music assets
- AUDIO-LICENSES.md: track sources and license notes

The Remotion CLI reports the root zod@3.25.76 as a version mismatch against @remotion/zod-types’ expected 4.5.4. The compositions do not use Remotion’s schema helpers, and all three films rendered successfully. The application’s Zod dependency was left untouched.
