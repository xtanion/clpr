import { db, type Pack } from "./db";
import type { GistDoc } from "@/lib/api";

// High-level Knowledge Pack store. Every call is wrapped so that a browser without
// IndexedDB (private mode, disabled storage) degrades to "no cache" instead of
// throwing — the app must keep working online even when offline storage is denied.

export const packKey = (stage: number, topic: number) => `s${stage}t${topic}`;

export async function getPack(stage: number, topic: number): Promise<Pack | undefined> {
  try {
    return await db().packs.get(packKey(stage, topic));
  } catch {
    return undefined;
  }
}

export async function putPack(stage: number, topic: number, label: string, doc: GistDoc): Promise<void> {
  try {
    await db().packs.put({
      key: packKey(stage, topic),
      stage,
      topic,
      label,
      version: doc.version || "",
      doc,
      savedAt: Date.now(),
    });
  } catch {
    // Quota exceeded / storage unavailable: reading online still works, so swallow.
  }
}

// True when a pack for this concept is stored at the given (current) version, so a
// predictive download can skip it. A blank current version means "unknown" — treat
// any stored pack as good enough rather than re-downloading forever.
export async function hasFreshPack(stage: number, topic: number, version: string): Promise<boolean> {
  const p = await getPack(stage, topic);
  if (!p) return false;
  return !version || p.version === version;
}

export async function cachedKeys(): Promise<Set<string>> {
  try {
    return new Set(await db().packs.toCollection().primaryKeys());
  } catch {
    return new Set();
  }
}

export async function allPacks(): Promise<Pack[]> {
  try {
    return await db().packs.orderBy("savedAt").reverse().toArray();
  } catch {
    return [];
  }
}

export async function packCount(): Promise<number> {
  try {
    return await db().packs.count();
  } catch {
    return 0;
  }
}
