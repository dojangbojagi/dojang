"use client";

import { useState, type ReactNode } from "react";

/* A <details> whose content is only mounted once it has been opened, so a heavy panel is not fetched for visitors who never look. */
export function LazyDetails({ summary, children }: { summary: string; children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return (
    <details className="cdir__more" onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) setOpened(true); }}>
      <summary>{summary}</summary>
      {opened ? children : null}
    </details>
  );
}
