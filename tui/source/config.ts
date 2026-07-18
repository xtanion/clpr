// Client configuration: base URL, shared API key, and the personal token.
// Stored as JSON at $XDG_CONFIG_HOME/clpr/config.json (default ~/.config/clpr).
// Env vars CLPR_BASE_URL / CLPR_API_KEY take precedence so the CLI works in shells
// or CI without a config file.

import {homedir} from 'node:os';
import {join} from 'node:path';
import {
	mkdirSync,
	readFileSync,
	writeFileSync,
	existsSync,
	chmodSync,
} from 'node:fs';

export type Config = {
	baseUrl: string;
	apiKey: string;
	token: string;
	theme: string;
	reading: number; // camp index the user last opened (-1 = none)
};

export const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

const CONFIG_DIR = join(
	process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config'),
	'clpr',
);
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function readFile(): Partial<Config> {
	if (!existsSync(CONFIG_FILE)) return {};
	try {
		return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Partial<Config>;
	} catch {
		return {};
	}
}

export function load(): Config {
	const data = readFile();
	return {
		baseUrl: process.env['CLPR_BASE_URL'] || data.baseUrl || DEFAULT_BASE_URL,
		apiKey: process.env['CLPR_API_KEY'] || data.apiKey || '',
		token: data.token || '',
		theme: process.env['CLPR_THEME'] || data.theme || '',
		reading: typeof data.reading === 'number' ? data.reading : -1,
	};
}

function write(data: Partial<Config>): void {
	mkdirSync(CONFIG_DIR, {recursive: true});
	writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
	chmodSync(CONFIG_FILE, 0o600);
}

export function save(patch: Partial<Config>): void {
	write({...readFile(), ...patch});
}

export function saveToken(token: string): void {
	write({...readFile(), token});
}

export function saveTheme(theme: string): void {
	write({...readFile(), theme});
}

export function saveReading(reading: number): void {
	write({...readFile(), reading});
}

export function clearToken(): void {
	const data = readFile();
	delete data.token;
	write(data);
}
