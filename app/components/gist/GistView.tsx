"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, ApiError, type GistDoc } from "@/lib/api";
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

export function GistView({ stage, topic, label }: { stage: number; topic: number; label: string }) {
  const [doc, setDoc] = useState<GistDoc | null>(null);
  const [error, setError] = useState<"notfound" | "error" | null>(null);

  useEffect(() => {
    let alive = true;
    setDoc(null); setError(null);
    api.getGists(stage, topic)
      .then((d) => { if (alive) setDoc(d); })
      .catch((e) => { if (alive) setError(e instanceof ApiError && e.status === 404 ? "notfound" : "error"); });
    return () => { alive = false; };
  }, [stage, topic]);

  // Author-posted single gist: show the first (and normally only) mode's body.
  const modeIds = doc ? Object.keys(doc.modes) : [];
  const gist = modeIds.length ? doc!.modes[modeIds[0]] : null;

  return (
    <div className="gist-page">
      <Link href="/climb" className="gist-back"><ArrowLeft size={13} /> back to climb</Link>
      <p className="eyebrow" style={{ marginTop: 20 }}>gist</p>
      <h1 className="gist-page-title">{label}</h1>
      {gist && readTime(gist.meta) && <p className="gist-meta">{readTime(gist.meta)}</p>}

      <div className="gist-page-body md">
        {error === "error" && <p className="muted">Could not load this gist.</p>}
        {error === "notfound" && <p className="muted">No concept found for this topic.</p>}
        {!error && !doc && <p className="muted">loading…</p>}
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
