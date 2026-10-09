"use client";

import { useEffect } from "react";

/* Progressive enhancement for the landing: marks the page as script-driven, then
   reveals [data-lp-reveal] blocks as they enter the viewport. Without JS, or with
   reduced motion, everything is simply visible. */
export function LandingEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root) return;
    root.dataset.js = "1";

    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-lp-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.in = "1";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      delete root.dataset.js;
    };
  }, []);

  return null;
}
