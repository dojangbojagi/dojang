"use client";

import { useEffect } from "react";

export function ReferenceEffects() {
  useEffect(() => {
    const toneNodes = Array.from(document.querySelectorAll<HTMLElement>(".stub[data-tone]"));
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-inview]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealObserver = !reduced && "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-inview");
          revealObserver.unobserve(entry.target);
        }
      }, { threshold: 0.12 })
      : undefined;
    if (revealObserver) revealNodes.forEach((node) => revealObserver.observe(node));
    else revealNodes.forEach((node) => node.classList.add("is-inview"));

    const toneObserver = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) document.body.dataset.tone = (entry.target as HTMLElement).dataset.tone ?? "neutral";
        }
      }, { rootMargin: "-35% 0px -50% 0px" })
      : undefined;
    if (toneObserver) toneNodes.forEach((node) => toneObserver.observe(node));
    else if (toneNodes[0]?.dataset.tone) document.body.dataset.tone = toneNodes[0].dataset.tone;

    return () => {
      revealObserver?.disconnect();
      toneObserver?.disconnect();
      delete document.body.dataset.tone;
    };
  }, []);

  return null;
}
