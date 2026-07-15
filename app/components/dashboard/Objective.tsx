"use client";

import { nextObjective, altitude, completedTopics } from "@/lib/store";
import { useGarageState } from "@/lib/garageView";
import { useContent } from "@/lib/content";
import { ArrowLink } from "@/components/ui/ArrowLink";

const BAR_W = 22;
function AsciiBar({ pct }: { pct: number }) {
  const f = Math.round((pct / 100) * BAR_W);
  return (
    <span className="ascii-bar">
      <span className="sev-ok">{"█".repeat(f)}</span>
      <span className="ghud-dim">{"░".repeat(BAR_W - f)}</span>
    </span>
  );
}

export function Objective() {
  const { s, hydrated } = useGarageState();
  const { totalTopics: TOTAL_TOPICS } = useContent();
  const o = hydrated ? nextObjective(s) : null;
  const pct = Math.round((hydrated ? altitude(s) : 0) * 100);
  const done = hydrated ? completedTopics(s) : 0;

  return (
    <div>
      <p className="eyebrow obj-title">continue...</p>
      <div className="obj-grid">
      <div className="obj-cell">
        {o ? (
          <>
            <div className="obj-label">{o.label}</div>
            <div className="obj-sub">
              {o.kind === "topic" ? `camp: ${o.camp}` : o.kind === "clpr" ? `${o.camp} . camp complete, one quiz away` : "nice work"}
            </div>
          </>
        ) : (
          <div className="obj-label muted">loading</div>
        )}
        {o && o.kind !== "done" && (
          <div style={{ marginTop: 12 }}>
            <ArrowLink href={o.href}>{o.kind === "clpr" ? "attempt" : "start"}</ArrowLink>
          </div>
        )}
      </div>

      <div className="obj-cell obj-cell-divide">
        <div className="proj-top">
          <span className="proj-eyebrow">current project</span>
          <span className="proj-pct tnum sev-ok">{pct}%</span>
        </div>
        <div className="proj-name">Build a Tiny Inference Engine</div>
        <div className="proj-bar"><AsciiBar pct={pct} /></div>
        <div className="proj-sub">{done} / {TOTAL_TOPICS} modules installed</div>
      </div>
      </div>
    </div>
  );
}
