"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useClpr, useHydrated, saveEntry, todayIso, type Entry } from "@/lib/store";
import { ArrowLink } from "@/components/ui/ArrowLink";

const blank: Entry = { focus: 0, conf: 0, mins: "", summary: "", notes: "" };

function Rating({ label, value, onSet }: { label: string; value: number; onSet: (v: number) => void }) {
  return (
    <div className="rate">
      <div className="rate-head">
        <label>{label}</label>
        <span className={`rate-val${value ? " on" : ""}`}>{value ? `${value} / 5` : "not set"}</span>
      </div>
      <div className="rate-ascii">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n} of 5`}
            className={`rate-block${value >= n ? " on" : ""}`}
            onClick={() => onSet(value === n ? 0 : n)}
          >
            {value >= n ? "█" : "░"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheckInForm() {
  const s = useClpr();
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<Entry>(blank);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const key = todayIso();

  useEffect(() => {
    if (!hydrated) return;
    const e = s.entries[key];
    setDraft(e ? { focus: e.focus || 0, conf: e.conf || 0, mins: e.mins || "", summary: e.summary || "", notes: e.notes || "" } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const upd = (patch: Partial<Entry>) => setDraft((d) => ({ ...d, ...patch }));

  const words = useMemo(() => {
    const t = draft.notes.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [draft.notes]);

  const noteCount = useMemo(
    () => (hydrated ? Object.values(s.entries).filter((e) => (e.notes || "").trim().length > 0).length : 0),
    [s.entries, hydrated],
  );

  function onSave() {
    const empty = !draft.focus && !draft.conf && !draft.notes;
    saveEntry(key, empty ? null : draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSave();
    }
  }

  const dateLabel = hydrated ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase() : "";

  return (
    <div>
      <div className="section-head">
        <p className="eyebrow">checkin</p>
        <div className="checkin-headline">
          <h2 className="h-sm">{dateLabel}</h2>
          <ArrowLink href="/notes">open notes{noteCount ? ` (${noteCount})` : ""}</ArrowLink>
        </div>
      </div>

      <div className="checkin-grid">
        <Rating label="How focused were you?" value={draft.focus} onSet={(v) => upd({ focus: v })} />
        <Rating label="How well do you get it?" value={draft.conf} onSet={(v) => upd({ conf: v })} />
      </div>
      
      <div className="card">
        <div className="field">
          <div className="editor-head" style={{ justifyContent: "flex-end" }}>
            <div className="editor-tabs" role="tablist" aria-label="Editor mode">
              <button type="button" role="tab" aria-selected={tab === "write"} className={`editor-tab${tab === "write" ? " on" : ""}`} onClick={() => setTab("write")}>write</button>
              <button type="button" role="tab" aria-selected={tab === "preview"} className={`editor-tab${tab === "preview" ? " on" : ""}`} onClick={() => setTab("preview")}>preview</button>
            </div>
          </div>
          <div className="editor-box">
            {tab === "write" ? (
              <textarea id="learned" rows={8} placeholder="What clicked today? Be specific." value={draft.notes} onChange={(e) => upd({ notes: e.target.value })} onKeyDown={onKeyDown} />
            ) : (
              <div className="md editor-preview">
                {draft.notes.trim()
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.notes}</ReactMarkdown>
                  : <p className="muted">Nothing to preview yet.</p>}
              </div>
            )}
          </div>
          {/*<span className="field-hint">
            <span className="tnum"> <kbd>{hydrated && navigator.platform.startsWith("Mac") ? "cmd" : "ctrl"}</kbd>+<kbd>enter</kbd> to save.
          </span>*/}
        </div>

        

        <div className="checkin-actions">
          <ArrowLink onClick={onSave} className={`c-post${draft.notes.trim() ? " on" : ""}`}>save today</ArrowLink>
          <ArrowLink onClick={() => setDraft(blank)} arrow={false} className="ghost">clear</ArrowLink>
          <span className={`save-pill${saved ? " show" : ""}`}>saved</span>
        </div>
      </div>
    </div>
  );
}
