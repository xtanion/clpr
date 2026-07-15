"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useClpr, useHydrated } from "@/lib/store";

export function Notes() {
  const s = useClpr();
  const hydrated = useHydrated();

  if (!hydrated) return <p className="muted">loading</p>;

  const keys = Object.keys(s.entries)
    .filter((k) => (s.entries[k].notes || "").trim().length > 0)
    .sort()
    .reverse();

  if (keys.length === 0) {
    return <p className="muted">No notes yet. Write some in the kitchen check-in, markdown is supported.</p>;
  }

  return (
    <div className="notes-list">
      {keys.map((k) => {
        const e = s.entries[k];
        const date = new Date(k + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        return (
          <article key={k} className="note-entry">
            <div className="note-date">{date}</div>
            {e.summary && <div className="note-summary">{e.summary}</div>}
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.notes}</ReactMarkdown>
            </div>
          </article>
        );
      })}
    </div>
  );
}
