"use client";

import { useEffect } from "react";
import { useClpr, useHydrated } from "@/lib/store";
import { runPrefetch } from "@/lib/offline/prefetch";

// Invisible driver for smart downloads. It watches the learner's progress and, on
// browser idle, pulls the next few concepts into IndexedDB. It re-runs when progress
// advances (the prediction window shifts forward) and when connectivity returns.
export function OfflinePrefetch() {
  const s = useClpr();
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;

    const kick = () => { void runPrefetch(s).catch(() => {}); };
    const ric = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback : null;
    const id: number = ric ? ric(kick, { timeout: 4000 }) : window.setTimeout(kick, 1500);

    const onOnline = kick;
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("online", onOnline);
      if (ric) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
    // s.progress identity changes when a topic is toggled, moving the cursor forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, s.progress]);

  return null;
}
