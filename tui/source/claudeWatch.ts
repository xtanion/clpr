import fs from 'fs';
import path from 'path';
import os from 'os';
import {useState, useEffect, useRef} from 'react';

export type ClaudeState =
	| 'idle'
	| 'needs-input'
	| 'processing'
	| 'running-bash'
	| 'writing-code'
	| 'reading-files'
	| 'spawning-agent';

export type ClaudeStatus = {
	state: ClaudeState;
	project: string;
};

const IDLE_AFTER_MS = 5 * 60 * 1000;
const TAIL_BYTES = 65536;

function claudeProjectsDir(): string {
	return path.join(os.homedir(), '.claude', 'projects');
}

function projectLabel(slug: string): string {
	const parts = slug.split('-').filter(Boolean);
	return parts[parts.length - 1] ?? slug;
}

function findMostRecentSession(): {file: string; slug: string; mtime: number} | null {
	const root = claudeProjectsDir();
	if (!fs.existsSync(root)) return null;

	let best: {file: string; slug: string; mtime: number} | null = null;

	for (const slug of fs.readdirSync(root)) {
		const slugPath = path.join(root, slug);
		let stat: fs.Stats;
		try {
			stat = fs.statSync(slugPath);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) continue;

		for (const entry of fs.readdirSync(slugPath)) {
			if (!entry.endsWith('.jsonl')) continue;
			const file = path.join(slugPath, entry);
			let fstat: fs.Stats;
			try {
				fstat = fs.statSync(file);
			} catch {
				continue;
			}
			if (!best || fstat.mtimeMs > best.mtime) {
				best = {file, slug, mtime: fstat.mtimeMs};
			}
		}
	}

	return best;
}

function readTail(file: string, bytes: number): string {
	let fd: number;
	try {
		fd = fs.openSync(file, 'r');
	} catch {
		return '';
	}
	try {
		const size = fs.fstatSync(fd).size;
		const offset = Math.max(0, size - bytes);
		const buf = Buffer.alloc(Math.min(bytes, size));
		const read = fs.readSync(fd, buf, 0, buf.length, offset);
		return buf.slice(0, read).toString('utf8');
	} finally {
		fs.closeSync(fd);
	}
}

type JsonlEntry = {
	type: 'assistant' | 'user';
	message?: {
		stop_reason?: string;
		content?: Array<{
			type?: string;
			name?: string;
		}>;
	};
};

const ACTIVE_WINDOW_MS = 10_000;

function parseState(file: string, mtime: number): ClaudeState {
	const age = Date.now() - mtime;
	if (age > IDLE_AFTER_MS) return 'idle';

	const tail = readTail(file, TAIL_BYTES);
	const lines = tail.split('\n').filter(l => l.trim().startsWith('{'));

	// Claude Code appends metadata lines (last-prompt, ai-title, mode, system, …)
	// after the conversation entries, so scan backward for the last real turn.
	let last: JsonlEntry | null = null;
	for (let i = lines.length - 1; i >= 0; i--) {
		let entry: JsonlEntry;
		try {
			entry = JSON.parse(lines[i]!) as JsonlEntry;
		} catch {
			continue;
		}
		if (entry.type === 'assistant' || entry.type === 'user') {
			last = entry;
			break;
		}
	}

	if (!last) return 'idle';

	if (last.type === 'assistant') {
		const stopReason = last.message?.stop_reason;

		// end_turn is a stable resting state — show it regardless of age
		if (stopReason === 'end_turn') return 'needs-input';

		// tool_use means a tool is executing — only show if file is actively changing
		if (stopReason === 'tool_use' && age < ACTIVE_WINDOW_MS) {
			const content = last.message?.content ?? [];
			const toolUse = content.find(c => c.type === 'tool_use');
			const toolName = toolUse?.name ?? '';
			if (toolName === 'Bash') return 'running-bash';
			if (toolName === 'Edit' || toolName === 'Write') return 'writing-code';
			if (toolName === 'Read') return 'reading-files';
			if (toolName === 'Agent' || toolName === 'Workflow') return 'spawning-agent';
			return 'processing';
		}
	}

	// user entries (tool results, new messages) — only show processing if actively writing
	if (last.type === 'user' && age < ACTIVE_WINDOW_MS) return 'processing';

	return 'idle';
}

export function deriveStatus(session: {file: string; slug: string; mtime: number}): ClaudeStatus {
	return {
		state: parseState(session.file, session.mtime),
		project: projectLabel(session.slug),
	};
}

export function useClaudeStatus(pollMs = 1500): ClaudeStatus | null {
	const [status, setStatus] = useState<ClaudeStatus | null>(null);
	const watcherRef = useRef<fs.FSWatcher | null>(null);
	const currentFileRef = useRef<string | null>(null);

	useEffect(() => {
		let alive = true;

		function refresh() {
			if (!alive) return;
			const session = findMostRecentSession();
			if (!session) {
				setStatus(null);
				return;
			}

			if (session.file !== currentFileRef.current) {
				watcherRef.current?.close();
				currentFileRef.current = session.file;
				try {
					watcherRef.current = fs.watch(session.file, () => {
						if (!alive) return;
						try {
							const stat = fs.statSync(session.file);
							setStatus(deriveStatus({...session, mtime: stat.mtimeMs}));
						} catch {
							// file may have been rotated
						}
					});
				} catch {
					watcherRef.current = null;
				}
			}

			setStatus(deriveStatus(session));
		}

		refresh();
		const interval = setInterval(refresh, pollMs);

		return () => {
			alive = false;
			clearInterval(interval);
			watcherRef.current?.close();
			watcherRef.current = null;
			currentFileRef.current = null;
		};
	}, [pollMs]);

	return status;
}

export const STATE_LABEL: Record<ClaudeState, string> = {
	idle: 'idle',
	'needs-input': 'needs input',
	processing: 'processing',
	'running-bash': 'running bash',
	'writing-code': 'writing code',
	'reading-files': 'reading files',
	'spawning-agent': 'spawning agents',
};
