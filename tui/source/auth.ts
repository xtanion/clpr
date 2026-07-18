// Device-authorization login for the CLI (runs before the Ink UI). Starts the flow,
// opens the browser at the approval page, polls until approved, and stores the token.

import open from 'open';
import {Api, ApiError} from './api.js';
import * as config from './config.js';
import type {Config} from './config.js';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function login(cfg: Config): Promise<number> {
	const api = new Api(cfg);
	let start;
	try {
		start = await api.deviceStart();
	} catch (e) {
		if (e instanceof ApiError && e.status === 401) {
			console.error('error: API key rejected. Run `clpr configure --api-key ...`.');
		} else {
			console.error(`error: ${String(e)}`);
		}
		return 1;
	}

	console.log(`\n  Your device code: ${start.userCode}`);
	console.log(`  Open this URL to approve (sign in first if needed):\n    ${start.verificationUriComplete}\n`);
	try {
		await open(start.verificationUriComplete);
	} catch {
		// browser open is best-effort
	}
	process.stdout.write('  Waiting for approval');

	const deadline = Date.now() + start.expiresIn * 1000;
	while (Date.now() < deadline) {
		await sleep(start.interval * 1000);
		process.stdout.write('.');
		try {
			const poll = await api.devicePoll(start.deviceCode);
			if (poll.status === 'approved' && poll.token) {
				config.saveToken(poll.token);
				const who = poll.profile?.name || poll.profile?.username || 'your account';
				console.log(`\n\n  Signed in as ${who}. Token saved to ${config.CONFIG_FILE}\n`);
				return 0;
			}
		} catch (e) {
			if (e instanceof ApiError && (e.status === 403 || e.status === 410)) {
				console.error(`\n  error: authorization failed (${e.status}).`);
				return 1;
			}
			// transient/pending — keep polling
		}
	}
	console.error('\n  timed out waiting for approval.');
	return 1;
}

export async function whoami(cfg: Config): Promise<number> {
	if (!cfg.token) {
		console.log('not logged in. Run `clpr login`.');
		return 1;
	}
	try {
		const p = await new Api(cfg).me();
		console.log(`${p.name} (${p.username}) via ${p.provider}`);
		return 0;
	} catch {
		console.log('token invalid. Run `clpr login`.');
		return 1;
	}
}

export function logout(): number {
	config.clearToken();
	console.log('logged out (local token cleared).');
	return 0;
}
