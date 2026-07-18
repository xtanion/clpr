// HTTP client for the clpr backend. Talks directly to FastAPI (not the Next proxy),
// so it sends the shared X-API-Key and, once logged in, an Authorization: Bearer
// token. Mirrors the surface of the web client (app/lib/api.ts).

import {type Config} from './config.js';
import type {
	Content,
	State,
	Profile,
	BoardRow,
	RaceRow,
} from './types.js';

export class ApiError extends Error {
	constructor(public status: number, message: string) {
		super(message);
		this.name = 'ApiError';
	}
}

export type GistDoc = {
	stage: number;
	topic: number;
	version: string;
	modes: Record<string, {body: string; meta: Record<string, unknown>}>;
};

export class Api {
	constructor(private cfg: Config) {}

	private async req<T>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<T> {
		const headers: Record<string, string> = {'content-type': 'application/json'};
		if (this.cfg.apiKey) headers['x-api-key'] = this.cfg.apiKey;
		if (this.cfg.token) headers['authorization'] = `Bearer ${this.cfg.token}`;
		let res: Response;
		try {
			res = await fetch(`${this.cfg.baseUrl}${path}`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
			});
		} catch (err) {
			throw new ApiError(0, `cannot reach ${this.cfg.baseUrl}: ${String(err)}`);
		}
		if (!res.ok) throw new ApiError(res.status, `${method} ${path} -> ${res.status}`);
		const ct = res.headers.get('content-type') || '';
		return (ct.includes('application/json') ? await res.json() : await res.text()) as T;
	}

	// content (api key only)
	getContent = () => this.req<Content>('GET', '/api/content');
	getTrack = (topicId: string) =>
		this.req<Record<string, unknown>>('GET', `/api/track/${topicId}`);
	getPublicGarage = (username: string) =>
		this.req<Record<string, unknown>>('GET', `/api/users/${encodeURIComponent(username)}`);
	getGists = (stage: number, topic: number) =>
		this.req<GistDoc>('GET', `/api/concepts/${stage}/${topic}/gists`);

	// identity
	me = () => this.req<Profile>('GET', '/api/auth/me');

	// user state (bearer token)
	getState = () => this.req<State>('GET', '/api/state');
	getLeaderboard = () => this.req<BoardRow[]>('GET', '/api/leaderboard');
	getRaces = () => this.req<Record<string, RaceRow[]>>('GET', '/api/races/live');

	toggleProgress = (stage: number, topic: number, done?: boolean | null) =>
		this.req<State>('PUT', '/api/progress', {stage, topic, done});
	saveEntry = (e: {date: string; mins: string; summary: string}) =>
		this.req<State>('POST', '/api/entries', e);
	deleteEntry = (date: string) => this.req<State>('DELETE', `/api/entries/${date}`);
	addComment = (key: string, text: string, author = 'you') =>
		this.req<State>('POST', '/api/comments', {key, text, author});
	buildArtifact = (id: string) => this.req<State>('POST', '/api/artifacts', {id});
	attempt = (
		stage: number,
		responses: {index: number; value: string; frac: number; pass: boolean; msg: string}[],
		timeMs: number,
	) =>
		this.req<{
			attempt: {xp: number};
			score: number;
			passed: boolean;
			grades: unknown[];
		}>('POST', `/api/quizzes/${stage}/attempt`, {responses, timeMs});

	// device auth (used by the login command)
	deviceStart = () =>
		this.req<{
			deviceCode: string;
			userCode: string;
			verificationUri: string;
			verificationUriComplete: string;
			interval: number;
			expiresIn: number;
		}>('POST', '/api/auth/device/start');
	devicePoll = (deviceCode: string) =>
		this.req<{status: string; token?: string; profile?: Profile}>(
			'POST',
			'/api/auth/device/poll',
			{deviceCode},
		);
}
