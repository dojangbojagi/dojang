import { GlyphSolid, type ShapeId } from "@/components/landing/glyph-solid";

/** The picture at the head of an inner page: a turning object made of the landing's characters. */
export interface PageGlyph {
  shape: ShapeId;
  /** Said to screen readers, since the canvas is a picture. */
  label: string;
  /** One line under it. */
  caption: string;
  /** Which colours appear, so the key explains only what is on screen. */
  legend: readonly ("public" | "private" | "sealed")[];
}

const KEY = { public: "Public, on-chain", private: "Private, on your device", sealed: "Sealed" } as const;

export function PageGlyphFigure({ glyph }: { glyph: PageGlyph }) {
  return (
    <figure className="stub__glyph">
      <GlyphSolid className="stub__canvas" shape={glyph.shape} label={glyph.label} />
      <figcaption>
        <span>{glyph.caption}</span>
        <ul aria-label="Colour key">
          {glyph.legend.map((k) => <li key={k} data-k={k}>{KEY[k]}</li>)}
        </ul>
        <small className="stub__hint">Drag to turn it</small>
      </figcaption>
    </figure>
  );
}
