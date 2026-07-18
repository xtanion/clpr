#!/usr/bin/env node
// clpr CLI entrypoint.
//   clpr            launch the TUI
//   clpr login      device-authorization sign-in (opens the browser)
//   clpr logout     clear the stored token
//   clpr whoami     show the signed-in account
//   clpr configure  set base_url / api_key

import React from 'react';
import {render} from 'ink';
import * as config from './config.js';
import * as auth from './auth.js';
import {App} from './app.js';

function parseFlags(args: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (let i = 0; i < args.length; i++) {
		const a = args[i]!;
		if (a.startsWith('--')) {
			const key = a.slice(2);
			const val = args[i + 1];
			if (val && !val.startsWith('--')) {
				out[key] = val;
				i++;
			} else {
				out[key] = 'true';
			}
		}
	}
	return out;
}

async function main(): Promise<void> {
	const [cmd, ...rest] = process.argv.slice(2);
	const cfg = config.load();

	if (cmd === 'login') {
		process.exit(await auth.login(cfg));
	}
	if (cmd === 'logout') {
		process.exit(auth.logout());
	}
	if (cmd === 'whoami') {
		process.exit(await auth.whoami(cfg));
	}
	if (cmd === 'configure') {
		const f = parseFlags(rest);
		config.save({
			...(f['base-url'] ? {baseUrl: f['base-url']} : {}),
			...(f['api-key'] !== undefined ? {apiKey: f['api-key'] === 'true' ? '' : f['api-key']} : {}),
		});
		console.log(`saved to ${config.CONFIG_FILE}`);
		process.exit(0);
	}

	// Fullscreen: switch to the terminal's alternate screen buffer so the app owns the
	// whole viewport and the shell is restored untouched on exit.
	const leaveAlt = () => process.stdout.write('\x1b[?1049l');
	process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
	process.on('exit', leaveAlt);

	const {waitUntilExit} = render(<App cfg={cfg} />, {exitOnCtrlC: true});
	try {
		await waitUntilExit();
	} finally {
		leaveAlt();
		process.removeListener('exit', leaveAlt);
	}
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
