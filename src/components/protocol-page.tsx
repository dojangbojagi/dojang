import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { PageGlyphFigure, type PageGlyph } from "@/components/page-glyph";

const PAGES = [
  { label: "Home", href: "/" },
  { label: "Dojang", href: "/dojang" },
  { label: "Bojagi", href: "/bojagi" },
  { label: "Vault", href: "/vault" },
  { label: "Lending", href: "/lending" },
  { label: "Contracts", href: "/contracts" },
  { label: "Docs", href: "/docs" },
] as const;

export function ProtocolPage({
  index,
  tone,
  accent,
  status,
  glyph,
  title,
  lead,
  children,
}: {
  index: 2 | 3 | 4 | 5 | 6 | 7;
  tone: "dojang" | "bojagi" | "vault" | "neutral";
  accent: "celadon" | "periwinkle" | "gold";
  status: string;
  glyph: PageGlyph;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  const pageIndex = index - 1;
  const previous = PAGES[pageIndex - 1];
  const next = PAGES[pageIndex + 1];
  const style = { "--accent": `var(--${accent})` } as CSSProperties;

  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <a className="skip-link" href="#main">Skip to content</a>
      <main id="main">
        <section className="stub" data-tone={tone} style={style} aria-labelledby="page-title">
          <PageGlyphFigure glyph={glyph} />
          <div className="container">
            <p className="stub__eyebrow"><span className="stub__tag">{status}</span></p>
            <h1 className="stub__title" id="page-title">{title}</h1>
            <p className="lead stub__lead">{lead}</p>
            {children}
            <nav className="stub__pager protocol-pager" aria-label="Page navigation">
              <Link href={previous.href} rel="prev"><small>Previous</small><span>{previous.label}</span></Link>
              <Link href={next.href} rel="next"><small>Next</small><span>{next.label}</span></Link>
            </nav>
          </div>
        </section>
      </main>
    </>
  );
}
