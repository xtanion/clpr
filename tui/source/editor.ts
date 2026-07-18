// Open the user's $EDITOR to write a multi-line answer (code questions). Ink owns the
// terminal, so we drop raw mode and leave our alt-screen, run the editor synchronously
// with inherited stdio, then restore the alt-screen and raw mode. The editor provides
// its own syntax highlighting, so code colors match whatever the user already uses.

import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export function editInEditor(initial: string, setRawMode?: (v: boolean) => void): string {
	const file = join(mkdtempSync(join(tmpdir(), 'clpr-')), 'answer.js');
	writeFileSync(file, initial ?? '');
	const editor = process.env['EDITOR'] || process.env['VISUAL'] || 'vi';
	const [cmd, ...args] = editor.split(' ');

	try {
		setRawMode?.(false);
	} catch {
		/* not supported */
	}
	process.stdout.write('\x1b[?1049l'); // leave our fullscreen buffer
	spawnSync(cmd!, [...args, file], {stdio: 'inherit'});
	process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H'); // restore fullscreen
	try {
		setRawMode?.(true);
	} catch {
		/* ignore */
	}

	try {
		return readFileSync(file, 'utf8');
	} catch {
		return initial ?? '';
	}
}
