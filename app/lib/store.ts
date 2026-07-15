"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getContent } from "./content";
import { api, type ResponseIn } from "./api";
import type { Friend, Mat, Artifact } from "./data";

export type Entry = { focus: number; conf: number; mins: string; summary: string; notes: string };
export type Attempt = { id: number; stage: number; score: number; passed: boolean; timeMs: number; xp: number; firstClear: boolean; at: string };
export type LedgerRow = { source: number; xp: number; at: string };
export type Comment = { id: number; author: string; text: string; at: string };

export type State = {
  entries: Record<string, Entry>;
  progress: Record<string, boolean>;
  startDate: string;
  attempts: Attempt[];
  ledger: LedgerRow[];
  comments: Record<string, Comment[]>;
  artifacts: string[];
};

const EMPTY: State = { entries: {}, progress: {}, startDate: "", attempts: [], ledger: [], comments: {}, artifacts: [] };

let state: State = EMPTY;
let hydrated = false;
let hydrating = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function snapshot() { return state; }
function serverSnapshot() { return EMPTY; }

function normalize(doc: Partial<State>): State { return { ...EMPTY, ...doc }; }

// Optimistic local merge (no persistence — the server is the source of truth).
function set(next: Partial<State>) { state = { ...state, ...next }; emit(); }
// Replace local state from an authoritative server document.
function setState(doc: Partial<State>) { state = normalize(doc); emit(); }

export function hydrate() {
  if (hydrated || hydrating) return;
  hydrating = true;
  api.getState<State>()
    .then((doc) => { hydrated = true; setState(doc); })
    .catch(() => { hydrated = true; emit(); });
}

export function useClpr(): State {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function useHydrated(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => { hydrate(); setH(true); }, []);
  return h;
}

/* ---------- derived selectors (content sourced from the backend) ---------- */
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const todayIso = () => iso(new Date());

export const topicKey = (s: number, t: number) => `s${s}t${t}`;
export const isTopicDone = (s: State, st: number, t: number) => !!s.progress[topicKey(st, t)];

export function stageDoneCount(s: State, st: number) {
  const roadmap = getContent().roadmap;
  let n = 0;
  for (let t = 0; t < roadmap[st].topics.length; t++) if (isTopicDone(s, st, t)) n++;
  return n;
}
export const stageTopicsComplete = (s: State, st: number) => stageDoneCount(s, st) === getContent().roadmap[st].topics.length;

export function completedTopics(s: State) {
  const roadmap = getContent().roadmap;
  let n = 0;
  for (let st = 0; st < roadmap.length; st++) n += stageDoneCount(s, st);
  return n;
}
export const altitude = (s: State) => completedTopics(s) / getContent().totalTopics;
export const daysLogged = (s: State) => Object.keys(s.entries).length;

export function streak(s: State) {
  const d = new Date();
  if (!s.entries[iso(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (s.entries[iso(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const clprCleared = (s: State, st: number) => s.attempts.some((a) => a.stage === st && a.passed);

export function bestAttempt(s: State, st: number): Attempt | null {
  let best: Attempt | null = null;
  for (const a of s.attempts) {
    if (a.stage === st && a.passed) {
      if (!best || a.score > best.score || (a.score === best.score && a.timeMs < best.timeMs)) best = a;
    }
  }
  return best;
}

export const totalXp = (s: State) => Math.round(s.ledger.reduce((x, r) => x + r.xp, 0));

export function highestStageCleared(s: State) {
  const roadmap = getContent().roadmap;
  let h = 0;
  for (let st = 0; st < roadmap.length; st++) if (clprCleared(s, st)) h = st + 1;
  return h;
}

export const PASS = 0.7;

export type BoardRow = { name: string; handle: string; xp: number; stage: number; streak: number; me: boolean; rank: number };

export type MeId = { name: string; handle: string };
export const DEFAULT_ME: MeId = { name: "You", handle: "you" };

export function leaderboard(s: State, meId: MeId = DEFAULT_ME): BoardRow[] {
  const me = { name: meId.name, handle: meId.handle, xp: totalXp(s), stage: highestStageCleared(s), streak: streak(s), me: true, rank: 0 };
  const rows: BoardRow[] = getContent().friends.map((f: Friend) => ({ ...f, me: false, rank: 0 }));
  rows.push(me);
  rows.sort((a, b) => b.xp - a.xp);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export function myRank(s: State) {
  const b = leaderboard(s);
  const mine = b.find((r) => r.me);
  return mine ? mine.rank : b.length;
}

/* ---------- Materials & garage ---------- */
export type MatCount = Record<Mat, number>;
const zeroMats = (): MatCount => ({ steel: 0, bearings: 0, titanium: 0, carbon: 0 });

export function materialsEarned(s: State): MatCount {
  const { roadmap, campMaterials } = getContent();
  const out = zeroMats();
  for (let st = 0; st < roadmap.length; st++) {
    if (!clprCleared(s, st)) continue;
    const g = campMaterials[st] || {};
    (Object.keys(g) as Mat[]).forEach((k) => { out[k] += g[k] || 0; });
  }
  return out;
}

export function materialsSpent(s: State): MatCount {
  const { artifacts } = getContent();
  const out = zeroMats();
  for (const id of s.artifacts) {
    const a = artifacts.find((x) => x.id === id);
    if (!a) continue;
    (Object.keys(a.cost) as Mat[]).forEach((k) => { out[k] += a.cost[k] || 0; });
  }
  return out;
}

export function materialsBalance(s: State): MatCount {
  const e = materialsEarned(s), sp = materialsSpent(s);
  return { steel: e.steel - sp.steel, bearings: e.bearings - sp.bearings, titanium: e.titanium - sp.titanium, carbon: e.carbon - sp.carbon };
}

export type ArtifactState =
  | { state: "installed" }
  | { state: "locked"; req: number }
  | { state: "short"; missing: MatCount }
  | { state: "buildable" };

export function artifactState(s: State, a: Artifact): ArtifactState {
  if (s.artifacts.includes(a.id)) return { state: "installed" };
  if (highestStageCleared(s) < a.req) return { state: "locked", req: a.req };
  const bal = materialsBalance(s);
  const missing = zeroMats();
  let short = false;
  (Object.keys(a.cost) as Mat[]).forEach((k) => {
    const deficit = (a.cost[k] || 0) - bal[k];
    if (deficit > 0) { missing[k] = deficit; short = true; }
  });
  return short ? { state: "short", missing } : { state: "buildable" };
}

export function installedCount(s: State) { return s.artifacts.length; }

export function buildArtifact(id: string) {
  const a = getContent().artifacts.find((x) => x.id === id);
  if (!a || state.artifacts.includes(id)) return;
  const st = artifactState(state, a);
  if (st.state !== "buildable") return;
  set({ artifacts: [...state.artifacts, id] });
  api.buildArtifact<State>(id).then(setState).catch(() => {});
}

// Dependency gate: a camp unlocks when the previous camp's topics are all done.
export function campUnlocked(s: State, campId: number): boolean {
  if (campId <= 0) return true;
  return stageTopicsComplete(s, campId - 1);
}

const TITLES = ["Apprentice", "Builder", "Engineer", "Architect", "Master Builder"];
export function engineerTitle(s: State): string {
  const c = highestStageCleared(s);
  if (c >= 7) return TITLES[4];
  if (c >= 5) return TITLES[3];
  if (c >= 3) return TITLES[2];
  if (c >= 1) return TITLES[1];
  return TITLES[0];
}

export type Objective =
  | { kind: "topic"; camp: string; label: string; href: string }
  | { kind: "clpr"; camp: string; label: string; href: string }
  | { kind: "done"; camp: string; label: string; href: string };

export function nextObjective(s: State): Objective {
  const { roadmap, quizzes } = getContent();
  for (let st = 0; st < roadmap.length; st++) {
    const topics = roadmap[st].topics;
    for (let t = 0; t < topics.length; t++) {
      if (!isTopicDone(s, st, t)) {
        return { kind: "topic", camp: roadmap[st].alt, label: topics[t].label, href: "/climb" };
      }
    }
    if (quizzes.some((q) => q.stage === st) && !clprCleared(s, st)) {
      return { kind: "clpr", camp: roadmap[st].alt, label: `clear the clpr, summit ${roadmap[st].alt}`, href: `/quiz?stage=${st}` };
    }
  }
  return { kind: "done", camp: "", label: "You have summited every camp.", href: "/climb" };
}

/* ---------- mutations (optimistic locally, authoritative on the server) ---------- */
export function toggleTopic(st: number, t: number) {
  const k = topicKey(st, t);
  const willBeDone = !state.progress[k];
  const progress = { ...state.progress };
  if (willBeDone) progress[k] = true; else delete progress[k];
  set({ progress });
  api.toggleProgress<State>({ stage: st, topic: t, done: willBeDone }).then(setState).catch(() => {});
}

export function saveEntry(dateIso: string, entry: Entry | null) {
  const entries = { ...state.entries };
  if (entry) entries[dateIso] = entry; else delete entries[dateIso];
  set({ entries });
  const p = entry
    ? api.saveEntry<State>({ date: dateIso, ...entry })
    : api.deleteEntry<State>(dateIso);
  p.then(setState).catch(() => {});
}

export function setStartDate(v: string) {
  set({ startDate: v });
  api.setStartDate<State>(v).then(setState).catch(() => {});
}

export type AttemptResult = { attempt: Attempt; score: number; passed: boolean };

export async function recordAttempt(stage: number, responses: ResponseIn[], timeMs: number): Promise<AttemptResult> {
  const res = await api.attempt<AttemptResult>(stage, { responses, timeMs });
  try { setState(await api.getState<State>()); } catch {}
  return res;
}

export function addComment(key: string, text: string, author = "you") {
  const c: Comment = { id: Date.now(), author, text, at: new Date().toISOString() };
  const list = state.comments[key] ? [...state.comments[key], c] : [c];
  set({ comments: { ...state.comments, [key]: list } });
  api.addComment<State>({ key, text, author }).then(setState).catch(() => {});
}

export function resetAll() { api.reset<State>().then(setState).catch(() => {}); }
export function exportData() { return state; }
