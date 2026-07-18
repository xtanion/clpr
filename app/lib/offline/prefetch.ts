import { api } from "@/lib/api";
import { getContent } from "@/lib/content";
import type { State } from "@/lib/store";
import { predictNext } from "./predict";
import { getPack, putPack } from "./packs";

// Downloads predicted Knowledge Packs into IndexedDB ahead of the learner. No user
// action: this is invoked on idle and whenever progress advances. It is deliberately
// conservative — it does nothing offline or on a data-saver / slow connection, and
// re-downloads a concept only when its version has moved.

type NavConn = { saveData?: boolean; effectiveType?: string };

function shouldPrefetch(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.onLine === false) return false;
  const conn = (navigator as Navigator & { connection?: NavConn }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
  return true;
}

let running = false;

export async function runPrefetch(s: State, window = 6): Promise<void> {
  if (running || !shouldPrefetch()) return;
  running = true;
  try {
    const targets = predictNext(getContent(), s, window);
    for (const c of targets) {
      if (!shouldPrefetch()) break; // connection dropped mid-run
      const existing = await getPack(c.stage, c.topic);
      if (existing && (!c.version || existing.version === c.version)) continue;
      try {
        const doc = await api.getGists(c.stage, c.topic);
        await putPack(c.stage, c.topic, c.label, doc);
      } catch {
        // A single concept failing (404, transient) must not stop the run.
      }
    }
  } finally {
    running = false;
  }
}
