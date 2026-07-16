"use client";

import { useEffect, useId, useRef, useState } from "react";

// Mermaid is heavy, so it's dynamically imported and initialized once, lazily.
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
      return m.default;
    });
  }
  return mermaidPromise;
}

export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const rawId = useId();
  const id = useRef(`mmd-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`);

  useEffect(() => {
    let alive = true;
    setSvg("");
    setFailed(false);
    loadMermaid()
      .then((mermaid) => mermaid.render(id.current, chart))
      .then(({ svg }) => { if (alive) setSvg(svg); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [chart]);

  if (failed) return <pre className="mermaid-fallback">{chart}</pre>;
  if (!svg) return <div className="mermaid-loading">rendering diagram…</div>;
  return <div className="mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
}
