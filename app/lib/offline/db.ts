import Dexie, { type Table } from "dexie";
import type { GistDoc } from "@/lib/api";

// A Knowledge Pack is one concept's full reading material (all gist modes) stored
// locally so it can be read with no network. Keyed the same way the app addresses
// topics: s{stage}t{topic}. We keep `version` denormalized on the row so predictive
// downloads can decide "already have this, at the current version" without opening
// the doc blob.
export type Pack = {
  key: string;
  stage: number;
  topic: number;
  label: string;
  version: string;
  doc: GistDoc;
  savedAt: number;
};

class OfflineDB extends Dexie {
  packs!: Table<Pack, string>;

  constructor() {
    super("clpr-offline");
    this.version(1).stores({ packs: "key, stage, topic, savedAt" });
  }
}

// Lazily instantiated so nothing touches IndexedDB during SSR / module import.
let _db: OfflineDB | null = null;
export function db(): OfflineDB {
  if (!_db) _db = new OfflineDB();
  return _db;
}
