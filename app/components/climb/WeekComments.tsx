"use client";

import { useState } from "react";
import { useClpr, useHydrated, addComment } from "@/lib/store";
import { ArrowLink } from "@/components/ui/ArrowLink";

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function WeekComments({ weekKey }: { weekKey: string }) {
  const s = useClpr();
  const hydrated = useHydrated();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const list = hydrated ? s.comments[weekKey] ?? [] : [];

  function post() {
    const t = text.trim();
    if (!t) return;
    addComment(weekKey, t);
    setText("");
  }

  return (
    <div className="comments tree">
      <button className="tree-row branch" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="tree-caret">{open ? "-" : "+"}</span>
        <span className="tree-label">comments/</span>
        <span className={`tree-frac ${list.length ? "sev-info" : "sev-dim"}`}>{list.length}</span>
      </button>

      {open && (
        <div className="tree-children">
          {list.length === 0 && (
            <div className="tree-row soon">
              <span className="tree-prefix">├─ </span>
              <span className="tree-label">no comments yet</span>
            </div>
          )}
          {list.map((c) => (
            <div key={c.id} className="c-node">
              <div className="tree-row">
                <span className="tree-prefix">├─ </span>
                <span className="c-meta">{c.author} · {relTime(c.at)}</span>
              </div>
              <div className="tree-row c-body">
                <span className="tree-prefix">│  </span>
                <span className="c-text">{c.text}</span>
              </div>
            </div>
          ))}
          <div className="tree-row c-form-row">
            <span className="tree-prefix">└─ </span>
            <div className="comment-form c-form">
              <input type="text" placeholder="write a comment" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); post(); } }} />
              <ArrowLink onClick={post} disabled={!text.trim()} className={`c-post${text.trim() ? " on" : ""}`}>post</ArrowLink>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
