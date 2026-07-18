// Headless smoke test: render the app with a mock API and walk every screen,
// asserting nothing throws and key content shows up. Run: npm run build && node dist/smoke.js
import React from 'react';
import {render} from 'ink-testing-library';
import {App} from './app.js';
import type {Api} from './api.js';
import type {Config} from './config.js';
import type {Content, State} from './types.js';

const content: Content = {
	roadmap: [
		{
			alt: 'Base camp',
			title: 'Micrograd',
			blurb: 'start here',
			topics: [
				{label: 'autograd', res: [{label: 'video', url: 'http://x', type: 'video'}], gists: {modes: ['30s'], version: '1'}},
				{label: 'mlp', res: []},
			],
		},
		{alt: 'The ridge', title: 'nanoGPT', blurb: 'next', topics: [{label: 'attention', res: []}, {label: 'kv', res: []}]},
	],
	totalTopics: 4,
	quizzes: [
		{
			stage: 0,
			questions: [
				{type: 'numeric', weight: 'full', prompt: '2+2?', answer: 4, tolerance: 0.1, unit: ''},
				{type: 'code', weight: 'full', prompt: 'double', signature: 'function d(x){}', entry: 'd', tests: [{args: [2], expected: 4}]},
			],
		},
	],
	tree: {id: 'compsci', label: 'compsci', children: [{id: 'llm', label: 'llm-inference', climb: 'llm-inference'}]},
	worlds: [{id: 'w1', name: 'Foundations', camps: [0, 1]}],
	artifacts: [{id: 'belay', name: 'Belay device', blurb: 'safety', req: 0, cost: {steel: 2}}],
	campMaterials: [{steel: 3}, {titanium: 1}],
};

const state: State = {
	entries: {'2026-07-16': {mins: '90', summary: 'good'}},
	progress: {s0t0: true},
	startDate: '2026-01-01',
	attempts: [],
	ledger: [],
	comments: {},
	artifacts: [],
};

const fakeApi = {
	getContent: async () => content,
	getState: async () => state,
	me: async () => ({id: 'github:1', email: '', name: 'Tester', username: 'tester', avatarUrl: '', provider: 'github'}),
	getLeaderboard: async () => [
		{name: 'Tester', xp: 100, stage: 1, streak: 2, rank: 1, me: true},
		{name: 'Other', xp: 50, stage: 0, streak: 0, rank: 2, me: false},
	],
	getRaces: async () => ({'0': [{name: 'Tester', ms: 65000, score: 0.9, me: true}]}),
	getGists: async () => ({stage: 0, topic: 0, version: '1', modes: {'30s': {body: '# quick\n- a\n- b', meta: {}}}}),
	toggleProgress: async () => state,
	addComment: async () => state,
	buildArtifact: async () => state,
	saveEntry: async () => state,
	deleteEntry: async () => state,
	attempt: async () => ({attempt: {xp: 210}, score: 1, passed: true, grades: []}),
} as unknown as Api;

const cfg: Config = {baseUrl: 'http://fake', apiKey: 'k', token: 'tok', theme: 'catppuccin'};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
	const {lastFrame, stdin, unmount} = render(<App cfg={cfg} api={fakeApi} />);
	await sleep(200);
	const checks: [string, string][] = [];
	const expect = (label: string, needle: string) => {
		const frame = lastFrame() ?? '';
		checks.push([label, frame.includes(needle) ? 'OK' : `MISSING (${needle})`]);
	};

	expect('boot/topbar', '● clpr');
	expect('home tree', 'Base camp');

	expect('theme footer', 'theme:catppuccin');

	stdin.write('2'); // board
	await sleep(120);
	expect('board', 'world ranking');

	stdin.write('3'); // notes
	await sleep(80);
	expect('notes', '2026-07-16');

	stdin.write('4'); // dashboard
	await sleep(80);
	expect('dashboard', 'activity');

	stdin.write(''); // esc -> back to notes
	await sleep(80);
	expect('esc-back', '2026-07-16');

	stdin.write('1'); // home
	await sleep(80);
	stdin.write('\r'); // open climb via enter on selected camp
	await sleep(80);
	expect('home->climb', 'take the clpr');

	unmount();
	let ok = true;
	for (const [label, res] of checks) {
		if (res !== 'OK') ok = false;
		console.log(`${res === 'OK' ? '✓' : '✗'} ${label}: ${res}`);
	}
	console.log(ok ? '\nSMOKE OK' : '\nSMOKE FAILED');
	process.exit(ok ? 0 : 1);
}

main();
