import { useEffect, useState, type ReactNode } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

const FACES: { family: string; file: string; weight: string }[] = [
  { family: "Quicksand", file: "fonts/quicksand-latin-400-normal.woff2", weight: "400" },
  { family: "Quicksand", file: "fonts/quicksand-latin-500-normal.woff2", weight: "500" },
  { family: "Quicksand", file: "fonts/quicksand-latin-600-normal.woff2", weight: "600" },
  { family: "Quicksand", file: "fonts/quicksand-latin-700-normal.woff2", weight: "700" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
];

/* Holds every frame until the site's own fonts (Quicksand and JetBrains Mono, copied from src/app/fonts) are loaded. */
export function FontGate({ children }: { children: ReactNode }) {
  const [handle] = useState(() => delayRender("GYEVO fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(
      FACES.map((f) => new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, { weight: f.weight }).load()),
    )
      .then((faces) => {
        faces.forEach((f) => document.fonts.add(f));
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
  return <>{ready ? children : null}</>;
}
