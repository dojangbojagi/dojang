"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import "./features-menu.css";

/* The public website's one menu. DOJANG and BOJAGI are the project's two technologies; everything else
   (lending, governance, docs, contracts) lives behind "Launch App". Used by the landing nav and by the
   public header of the two feature pages, so both read as one site. */
export const FEATURES = [
  { key: "dojang", name: "DOJANG", href: "/dojang", desc: "Project credentials and eligibility." },
  { key: "bojagi", name: "BOJAGI", href: "/bojagi", desc: "Private zero-knowledge proofs." },
] as const;

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
);
const ArrowUR = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 10.5 10.5 3.5M5 3.5h5.5V9" />
  </svg>
);

export function FeaturesMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  const items = () => Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>(".fx__item") ?? []);
  const focusItem = (index: number) => {
    const list = items();
    if (!list.length) return;
    list[(index + list.length) % list.length].focus();
  };
  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    }
  };
  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "ArrowDown") { event.preventDefault(); focusItem(at + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); focusItem(at - 1); }
    else if (event.key === "Home") { event.preventDefault(); focusItem(0); }
    else if (event.key === "End") { event.preventDefault(); focusItem(list.length - 1); }
  };

  return (
    <div
      className="fx"
      ref={rootRef}
      data-open={open}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        className="fx__btn"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKey}
      >
        <span>Features</span>
        <Chevron />
      </button>
      {open ? (
        <div className="fx__panel" id={panelId} onKeyDown={onPanelKey}>
          <p className="fx__label">The trust layer</p>
          <ul>
            {FEATURES.map((feature, index) => (
              <li key={feature.key}>
                <Link
                  className="fx__item"
                  href={feature.href}
                  aria-current={pathname === feature.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="fx__idx" aria-hidden="true">{`0${index + 1}`}</span>
                  <span className="fx__name">{feature.name}</span>
                  <span className="fx__desc">{feature.desc}</span>
                  <span className="fx__arrow" aria-hidden="true"><ArrowUR /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
