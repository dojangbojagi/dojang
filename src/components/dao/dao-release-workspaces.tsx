"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { DaoPhase2Workspace } from "@/components/dao/dao-phase2-workspace";
import { DaoWorkspace } from "@/components/dao/dao-workspace";

type DaoRelease = "phase1" | "phase2";

/** Keeps both independent governance workspaces available without merging their state. */
export function DaoReleaseWorkspaces({ phase2Visible }: { phase2Visible: boolean }) {
  const [selectedRelease, setSelectedRelease] = useState<DaoRelease>("phase1");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!phase2Visible) return;

    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft":
        nextIndex = (currentIndex + 1) % 2;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextRelease: DaoRelease = nextIndex === 0 ? "phase1" : "phase2";
    setSelectedRelease(nextRelease);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <>
      {phase2Visible && (
        <div className="protocol-actions" role="tablist" aria-label="DAO release" aria-orientation="horizontal">
          <button
            ref={(node) => { tabRefs.current[0] = node; }}
            id="dao-phase1-tab"
            className={`btn btn--${selectedRelease === "phase1" ? "primary" : "secondary"} btn--sm`}
            type="button"
            role="tab"
            aria-selected={selectedRelease === "phase1"}
            aria-controls="dao-phase1-panel"
            tabIndex={selectedRelease === "phase1" ? 0 : -1}
            onClick={() => setSelectedRelease("phase1")}
            onKeyDown={(event) => handleTabKeyDown(event, 0)}
          >
            Phase 1
          </button>
          <button
            ref={(node) => { tabRefs.current[1] = node; }}
            id="dao-phase2-tab"
            className={`btn btn--${selectedRelease === "phase2" ? "primary" : "secondary"} btn--sm`}
            type="button"
            role="tab"
            aria-selected={selectedRelease === "phase2"}
            aria-controls="dao-phase2-panel"
            tabIndex={selectedRelease === "phase2" ? 0 : -1}
            onClick={() => setSelectedRelease("phase2")}
            onKeyDown={(event) => handleTabKeyDown(event, 1)}
          >
            Phase 2
          </button>
        </div>
      )}

      <section
        id="dao-phase1-panel"
        className="protocol-section"
        role={phase2Visible ? "tabpanel" : undefined}
        aria-labelledby={phase2Visible ? "dao-phase1-tab" : undefined}
        hidden={phase2Visible && selectedRelease !== "phase1"}
      >
        <DaoWorkspace />
      </section>

      {phase2Visible && (
        <section
          id="dao-phase2-panel"
          className="protocol-section"
          role="tabpanel"
          aria-labelledby="dao-phase2-tab"
          hidden={selectedRelease !== "phase2"}
        >
          <DaoPhase2Workspace />
        </section>
      )}
    </>
  );
}
