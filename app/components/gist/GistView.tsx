"use client";

import { useState, type ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useGist } from "@/lib/offline/useGist";
import { Mermaid } from "./Mermaid";
import { ArrowLeft } from "@/components/ui/icons";

// Unwrap <pre> around a mermaid fence (Mermaid renders its own block), route
// ```mermaid fences to the Mermaid renderer, and lazy-load images.
const markdownComponents = {
  pre({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
    const child = children as { props?: { className?: string } } | undefined;
    if (/language-mermaid/.test(child?.props?.className || "")) return <>{children}</>;
    return <pre {...props}>{children}</pre>;
  },
  code({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
    if (/language-mermaid/.test(className || "")) {
      return <Mermaid chart={String(children).replace(/\n$/, "")} />;
    }
    return <code className={className} {...props}>{children}</code>;
  },
  img(props: ComponentPropsWithoutRef<"img">) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ""} loading="lazy" />;
  },
};

function readTime(meta: Record<string, unknown> | undefined): string {
  const s = typeof meta?.reading_seconds === "number" ? meta.reading_seconds : 0;
  if (!s) return "";
  return s < 60 ? `${s}s read` : `${Math.round(s / 60)} min read`;
}

// Short tab labels for the canonical reading modes; unknown ids fall back to the id.
const MODE_LABELS: Record<string, string> = {
  "30s": "30 sec",
  "2min": "2 min",
  "5min": "5 min",
  deep: "Deep dive",
  cheatsheet: "Cheatsheet",
};
const modeLabel = (id: string) => MODE_LABELS[id] ?? id;

export function GistView({ stage, topic, label }: { stage: number; topic: number; label: string }) {
  const { doc, source, error, loading, offline } = useGist(stage, topic, label);

  // Remember the learner's preferred reading depth across concepts. It's applied
  // only when the next concept actually has that mode, otherwise we fall back to the
  // first available (the API orders modes canonically: 30s -> deep -> cheatsheet).
  const [pref, setPref] = useState<string | null>(null);
  const modeIds = doc ? Object.keys(doc.modes) : [];
  const active = pref && modeIds.includes(pref) ? pref : modeIds[0];
  const gist = active ? doc!.modes[active] : null;
  const rt = gist ? readTime(gist.meta) : "";
  const offlineTag = offline && doc ? "offline copy" : source === "cache" && doc ? "saved offline" : "";

  return (
    <div className="gist-page">
      <Link href="/climb" className="gist-back"><ArrowLeft size={13} /> back to climb</Link>
      <p className="eyebrow" style={{ marginTop: 20 }}>gist</p>
      <h1 className="gist-page-title">{label}</h1>
      {(rt || offlineTag) && (
        <p className="gist-meta">
          {rt && <span>{rt}</span>}
          {offlineTag && <span className="gist-offline-tag">{offlineTag}</span>}
        </p>
      )}

      {modeIds.length > 1 && (
        <div className="gist-modes" role="tablist" aria-label="reading length">
          {modeIds.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={id === active}
              className={`gist-mode${id === active ? " on" : ""}`}
              onClick={() => setPref(id)}
            >
              {modeLabel(id)}
            </button>
          ))}
        </div>
      )}

      <div className="gist-page-body md">
        {error === "error" && <p className="muted">Could not load this gist.</p>}
        {error === "notfound" && <p className="muted">No concept found for this topic.</p>}
        {!error && !doc && loading && <p className="muted">loading…</p>}
        {!error && doc && !gist && <p className="muted">No gist has been written for this concept yet.</p>}
        {gist && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {gist.body}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
