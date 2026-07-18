// Derived selectors ported from the web store (app/lib/store.ts). Pure functions of
// (content, state); the server stays authoritative, these just drive rendering/gating.

import type {Content, State, Mat} from './types.js';

export const MATS: Mat[] = ['steel', 'bearings', 'titanium', 'carbon'];
export const PASS = 0.7;
const TITLES = ['Apprentice', 'Builder', 'Engineer', 'Architect', 'Master Builder'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const todayIso = () => iso(new Date());
export const topicKey = (s: number, t: number) => `s${s}t${t}`;

export const isTopicDone = (s: State, st: number, t: number) =>
	!!s.progress[topicKey(st, t)];

export function stageDoneCount(c: Content, s: State, st: number): number {
	let n = 0;
	for (let t = 0; t < c.roadmap[st]!.topics.length; t++)
		if (isTopicDone(s, st, t)) n++;
	return n;
}

export const stageTopicsComplete = (c: Content, s: State, st: number) =>
	stageDoneCount(c, s, st) === c.roadmap[st]!.topics.length;

export function completedTopics(c: Content, s: State): number {
	let n = 0;
	for (let st = 0; st < c.roadmap.length; st++) n += stageDoneCount(c, s, st);
	return n;
}

export const altitude = (c: Content, s: State) =>
	c.totalTopics ? completedTopics(c, s) / c.totalTopics : 0;

export const daysLogged = (s: State) => Object.keys(s.entries).length;

export function streak(s: State): number {
	const d = new Date();
	if (!s.entries[iso(d)]) d.setDate(d.getDate() - 1);
	let n = 0;
	while (s.entries[iso(d)]) {
		n++;
		d.setDate(d.getDate() - 1);
	}
	return n;
}

export const clprCleared = (s: State, st: number) =>
	s.attempts.some(a => a.stage === st && a.passed);

export function highestStageCleared(c: Content, s: State): number {
	let h = 0;
	for (let st = 0; st < c.roadmap.length; st++) if (clprCleared(s, st)) h = st + 1;
	return h;
}

export const totalXp = (s: State) =>
	Math.round(s.ledger.reduce((x, r) => x + r.xp, 0));

export function campUnlocked(c: Content, s: State, campId: number): boolean {
	if (campId <= 0) return true;
	return stageTopicsComplete(c, s, campId - 1);
}

export function engineerTitle(c: Content, s: State): string {
	const cl = highestStageCleared(c, s);
	if (cl >= 7) return TITLES[4]!;
	if (cl >= 5) return TITLES[3]!;
	if (cl >= 3) return TITLES[2]!;
	if (cl >= 1) return TITLES[1]!;
	return TITLES[0]!;
}

export type Objective = {
	kind: 'topic' | 'clpr' | 'done';
	camp: string;
	label: string;
	stage: number;
};

export function nextObjective(c: Content, s: State): Objective {
	for (let st = 0; st < c.roadmap.length; st++) {
		const topics = c.roadmap[st]!.topics;
		for (let t = 0; t < topics.length; t++) {
			if (!isTopicDone(s, st, t))
				return {kind: 'topic', camp: c.roadmap[st]!.alt, label: topics[t]!.label, stage: st};
		}
		if (c.quizzes.some(q => q.stage === st) && !clprCleared(s, st))
			return {
				kind: 'clpr',
				camp: c.roadmap[st]!.alt,
				label: `clear the clpr, summit ${c.roadmap[st]!.alt}`,
				stage: st,
			};
	}
	return {kind: 'done', camp: '', label: 'You have summited every camp.', stage: -1};
}

type MatCount = Record<Mat, number>;
const zero = (): MatCount => ({steel: 0, bearings: 0, titanium: 0, carbon: 0});

export function materialsEarned(c: Content, s: State): MatCount {
	const out = zero();
	for (let st = 0; st < c.roadmap.length; st++) {
		if (!clprCleared(s, st)) continue;
		const g = c.campMaterials[st] || {};
		for (const k of MATS) out[k] += g[k] || 0;
	}
	return out;
}

export function materialsSpent(c: Content, s: State): MatCount {
	const out = zero();
	for (const id of s.artifacts) {
		const a = c.artifacts.find(x => x.id === id);
		if (!a) continue;
		for (const k of MATS) out[k] += a.cost[k] || 0;
	}
	return out;
}

export function materialsBalance(c: Content, s: State): MatCount {
	const e = materialsEarned(c, s);
	const sp = materialsSpent(c, s);
	return {
		steel: e.steel - sp.steel,
		bearings: e.bearings - sp.bearings,
		titanium: e.titanium - sp.titanium,
		carbon: e.carbon - sp.carbon,
	};
}

export type ArtifactState =
	| {state: 'installed'}
	| {state: 'locked'; req: number}
	| {state: 'short'; missing: MatCount}
	| {state: 'buildable'};

export function artifactState(
	c: Content,
	s: State,
	a: Content['artifacts'][number],
): ArtifactState {
	if (s.artifacts.includes(a.id)) return {state: 'installed'};
	if (highestStageCleared(c, s) < a.req) return {state: 'locked', req: a.req};
	const bal = materialsBalance(c, s);
	const missing = zero();
	let short = false;
	for (const k of MATS) {
		const deficit = (a.cost[k] || 0) - bal[k];
		if (deficit > 0) {
			missing[k] = deficit;
			short = true;
		}
	}
	return short ? {state: 'short', missing} : {state: 'buildable'};
}
