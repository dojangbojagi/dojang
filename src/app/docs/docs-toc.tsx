"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

/* The contents rail, and the one place that decides which section of the article is being read.

   Rule: the active item is the last section whose top has reached the reading line, which is the
   sticky header plus the sections' own scroll margin (so it is exactly where a clicked section lands);
   at the very end of the page the last section is active even if it is too short to reach the line.
   One item is active, always, and only a change of item causes a render, not a scroll position.

   A click makes its item active at once and holds it until the smooth scroll has settled, so the
   highlight does not flicker through the sections it passes. Everything else (scrolling either way,
   a direct #hash, Back and Forward) is derived from the scroll position alone, which is what the
   browser sets in every one of those cases, native or eased. */
export function DocsToc({ items }: { items: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState<string>(items[0][0]);
  const activeRef = useRef(active);
  const holdRef = useRef(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const sections = items.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    let raf = 0;
    let settle = 0;

    const set = (id: string) => {
      if (id === activeRef.current) return;
      activeRef.current = id;
      setActive(id);
    };

    const readingLine = () => {
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const margin = parseFloat(getComputedStyle(sections[0]).scrollMarginTop) || 0;
      return pad + margin + 6;
    };

    const compute = () => {
      raf = 0;
      if (holdRef.current) return;
      const line = readingLine();
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section.id;
        else break;
      }
      const doc = document.documentElement;
      if (window.scrollY + window.innerHeight >= doc.scrollHeight - 4) current = sections[sections.length - 1].id;
      set(current);
    };

    const schedule = () => {
      if (holdRef.current) {
        window.clearTimeout(settle);
        settle = window.setTimeout(() => {
          holdRef.current = false;
          schedule();
        }, 140);
        return;
      }
      if (!raf) raf = requestAnimationFrame(compute);
    };

    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (items.some(([i]) => i === id)) set(id);
      schedule();
    };

    compute();
    onHash();
    /* arriving on a #hash: once fonts and layout have settled, put the heading exactly where a click would */
    const arrival = window.location.hash.slice(1);
    if (arrival && items.some(([i]) => i === arrival)) {
      void document.fonts?.ready.then(() => {
        requestAnimationFrame(() => document.getElementById(arrival)?.scrollIntoView({ behavior: "auto", block: "start" }));
      });
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, [items]);

  /* on a phone the rail is a row of chips; keep the active one in view without moving the page */
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth + 1) return;
    const link = list.querySelector<HTMLElement>('a[aria-current="location"]');
    if (!link) return;
    list.scrollTo({ left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const onClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    holdRef.current = true;
    activeRef.current = id;
    setActive(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
    /* if the page was already there, no scroll event will follow: release the hold anyway */
    window.setTimeout(() => {
      holdRef.current = false;
      window.dispatchEvent(new Event("scroll"));
    }, reduce ? 60 : 900);
  };

  return (
    <nav className="docs__toc" aria-label="On this page">
      <p className="docs__toc-title">On this page</p>
      <ol ref={listRef}>
        {items.map(([id, label], i) => (
          <li key={id}>
            <a href={`#${id}`} onClick={onClick(id)} aria-current={active === id ? "location" : undefined} data-active={active === id ? "true" : "false"}>
              <span>{`0${i + 1}`}</span>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
