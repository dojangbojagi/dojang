import "./landing.css";
import { appEnv } from "@/lib/config/env";
import { contractsStatus } from "./contracts-status";
import { CoverReveal } from "./cover-reveal";
import { FinalReveal } from "./final-reveal";
import { hankenGrotesk, jetbrainsMono, sora } from "./fonts";
import { LandingEffects } from "./landing-effects";
import { LandingNav } from "./landing-nav";
import { ExploreSection, FactsSection, IdeaSection, PathSection } from "./sections";

/* The landing page. Presentation only: wallet, chain, credential and proof logic
   stay in the hooks and protocol modules, untouched. */
export function LandingPage() {
  const contracts = contractsStatus();

  return (
    <div className={`lp ${sora.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`} data-phase="light">
      <noscript>
        {/* Without JavaScript the opening can never animate, so show both phases stacked */}
        <style>{`.lp-cover{height:auto}.lp-stage{position:relative;height:auto;overflow:visible}.lp-p1{position:relative;min-height:100svh}.lp-box{position:relative;clip-path:none;min-height:100svh}.lp-veil-cover,.lp-outline{display:none}.lp-word,.lp-sub{transform:none;opacity:1}.lp-hero,.lp-h span,.lp-pointer-hint{opacity:1;transform:none}.lp-hero{min-height:100svh;height:auto}.lp-marq{position:relative}.lp-spacer{display:none}.lp-final{position:relative;height:auto}`}</style>
      </noscript>
      <a className="lp-skip" href="#lp-content">Skip to content</a>
      <LandingNav appName={appEnv.appName} />

      <main className="lp-curtain" id="lp-content">
        <CoverReveal tagline={appEnv.tagline} contractsLabel={contracts} />
        <IdeaSection />
        <PathSection />
        <ExploreSection />
        <FactsSection contracts={contracts} />
      </main>

      <FinalReveal appName={appEnv.appName} />
      <LandingEffects />
    </div>
  );
}
