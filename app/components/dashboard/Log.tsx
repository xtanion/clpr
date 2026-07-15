"use client";

import { useState } from "react";
import { useClpr, useHydrated } from "@/lib/store";

export function Log() {
  const s = useClpr();
  const hydrated = useHydrated();
  const [open, setOpen] = useState<string | null>(null);
  const keys = hydrated ? Object.keys(s.entries).sort().reverse() : [];

  return (
    <div>
      <div className="section-head">
        <p className="eyebrow">log</p>
      </div>
      {keys.length === 0 ? (
        <p className="muted">No check-ins yet. Save today to start the trail.</p>
      ) : (
        keys.map((k) => {
          const e = s.entries[k];
          const sev = (n: number) => (n <= 2 ? "sev-warn" : n >= 4 ? "sev-ok" : "sev-info");
          const chips: { t: string; sev: string }[] = [];
          if (e.focus) chips.push({ t: `focus ${e.focus}/5`, sev: sev(e.focus) });
          if (e.conf) chips.push({ t: `conf ${e.conf}/5`, sev: sev(e.conf) });
          const date = new Date(k + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          const notes = e.notes || "";
          const first = notes.split("\n")[0];
          const hasMore = notes.length > first.length;
          const isOpen = open === k;
          return (
            <div key={k} className="log-item" onClick={() => hasMore && setOpen(isOpen ? null : k)}>
              <div className="log-top">
                <span className="log-date">{date}</span>
                {chips.map((c) => <span key={c.t} className={`chip tnum ${c.sev}`}>{c.t}</span>)}
              </div>
              {first && !isOpen && <div className="log-summary">{first}{hasMore ? " ..." : ""}</div>}
              {notes && isOpen && <div className="log-notes">{notes}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
