// Local CLI-usage tracker. Accumulates active (app-open) time per day in a small
// JSON file next to the config, so "minutes used today" survives across launches.
// This is the auto-filled `mins` on a check-in and the total shown on the dashboard.

import {homedir} from 'node:os';
import {join} from 'node:path';
import {mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync} from 'node:fs';

const DIR = join(process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config'), 'clpr');
const FILE = join(DIR, 'usage.json');

const today = () => new Date().toISOString().slice(0, 10);

function read(): Record<string, number> {
	if (!existsSync(FILE)) return {};
	try {
		return JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, number>;
	} catch {
		return {};
	}
}

function write(d: Record<string, number>): void {
	try {
		mkdirSync(DIR, {recursive: true});
		writeFileSync(FILE, JSON.stringify(d));
		chmodSync(FILE, 0o600);
	} catch {
		/* best effort */
	}
}

let store: Record<string, number> = {};
let sessionStart = Date.now();

export function startSession(): void {
	store = read();
	sessionStart = Date.now();
}

/** Persist this session's elapsed seconds into the store and reset the clock (so
 *  repeated flushes never double-count). */
export function flush(): void {
	const now = Date.now();
	store[today()] = (store[today()] ?? 0) + (now - sessionStart) / 1000;
	sessionStart = now;
	write(store);
}

export function minutesToday(): number {
	const persisted = store[today()] ?? 0;
	return Math.floor((persisted + (Date.now() - sessionStart) / 1000) / 60);
}
