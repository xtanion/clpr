// Minimal, theme-aware markdown -> ANSI renderer for gists and journal notes.
// Replaces marked-terminal, which applied its own off-theme colors (red tables,
// yellow code, magenta headings) and emitted a "language not found" warning for
// mermaid fences that corrupted the frame. Colors here come from the active theme;
// code fences (including mermaid) render as plain muted text — no syntax highlighter.

import type {Theme} from './theme.js';

const BOLD = '\x1b[1m';
const NOBOLD = '\x1b[22m';
const ITALIC = '\x1b[3m';
const NOITALIC = '\x1b[23m';
const DIM = '\x1b[2m';
const NODIM = '\x1b[22m';
const FG = '\x1b[39m';

function fg(hex: string): string {
	const n = parseInt(hex.slice(1), 16);
	return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}
const col = (s: string, hex: string) => fg(hex) + s + FG;

function inline(s: string, theme: Theme): string {
	return s
		.replace(/`([^`]+)`/g, (_m, c: string) => col(c, theme.info))
		.replace(/\*\*([^*]+)\*\*/g, (_m, c: string) => BOLD + c + NOBOLD)
		.replace(/(^|\s)\*([^*]+)\*/g, (_m, p: string, c: string) => p + ITALIC + c + NOITALIC)
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t: string, u: string) => col(t, theme.accent) + DIM + ` (${u})` + NODIM);
}

export function renderMarkdown(md: string, theme: Theme): string {
	const out: string[] = [];
	let inFence = false;
	for (const raw of md.split('\n')) {
		const line = raw.replace(/\s+$/, '');
		if (line.trim().startsWith('```')) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			out.push('  ' + col(line, theme.muted));
			continue;
		}
		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			const text = inline(heading[2]!, theme);
			out.push(heading[1]!.length === 1 ? BOLD + col(text, theme.accent) + NOBOLD : BOLD + text + NOBOLD);
			continue;
		}
		if (/^\s*([-*])\s+/.test(line)) {
			const [, indent = '', body = ''] = line.match(/^(\s*)[-*]\s+(.*)$/) ?? [];
			out.push(indent + col('•', theme.accent) + ' ' + inline(body, theme));
			continue;
		}
		const quote = line.match(/^>\s?(.*)$/);
		if (quote) {
			out.push(col('▏ ' + inline(quote[1]!, theme), theme.muted));
			continue;
		}
		if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
			out.push(col('─'.repeat(24), theme.muted));
			continue;
		}
		if (/^\s*\|.*\|\s*$/.test(line)) {
			// table row (or separator) — render muted, no red cells
			if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) out.push(col(line.replace(/[^|]/g, '─'), theme.muted));
			else out.push(col(line, theme.muted));
			continue;
		}
		out.push(inline(line, theme));
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
