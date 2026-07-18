import React, {useEffect, useState, useCallback, useRef} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import Spinner from 'ink-spinner';
import {Api, ApiError} from './api.js';
import * as config from './config.js';
import type {Config} from './config.js';
import type {Content, State, Profile} from './types.js';
import {EMPTY_STATE} from './types.js';
import {ThemeContext, resolveTheme, nextTheme, ICON} from './theme.js';
import * as sel from './state.js';
import * as usage from './usage.js';
import {Home} from './screens/Home.js';
import {Climb} from './screens/Climb.js';
import {Board} from './screens/Board.js';
import {Notes} from './screens/Notes.js';
import {Dashboard} from './screens/Dashboard.js';
import {Quiz} from './screens/Quiz.js';
import {Gist} from './screens/Gist.js';
import {useClaudeStatus, STATE_LABEL} from './claudeWatch.js';

export type ScreenName = 'home' | 'climb' | 'board' | 'notes' | 'dashboard' | 'quiz' | 'gist';

// Climb isn't a top-level tab — it's reached by selecting a camp in the roadmap tree.
const NAV: [ScreenName, string, string][] = [
	['home', '1', 'blueprints'],
	['board', '2', 'board'],
	['notes', '3', 'notes'],
	['dashboard', '4', 'dashboard'],
];

export type Nav = {
	openClimb: (camp: number) => void;
	openQuiz: (stage: number) => void;
	openGist: (stage: number, topic: number) => void;
	go: (s: ScreenName) => void;
	back: () => void;
};

function useDimensions() {
	const [size, setSize] = useState({
		columns: process.stdout.columns || 80,
		rows: process.stdout.rows || 24,
	});
	useEffect(() => {
		const onResize = () =>
			setSize({columns: process.stdout.columns || 80, rows: process.stdout.rows || 24});
		process.stdout.on('resize', onResize);
		return () => {
			process.stdout.off('resize', onResize);
		};
	}, []);
	return size;
}

export function App({cfg, api: apiProp}: {cfg: Config; api?: Api}) {
	const {exit} = useApp();
	const [api] = useState(() => apiProp ?? new Api(cfg));
	const [content, setContent] = useState<Content | null>(null);
	const [st, setSt] = useState<State>(EMPTY_STATE);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [error, setError] = useState<string>('');
	const [screen, setScreen] = useState<ScreenName>('home');
	const [history, setHistory] = useState<ScreenName[]>([]);
	const [capture, setCapture] = useState(false);
	const [camp, setCamp] = useState(0);
	const [quizStage, setQuizStage] = useState(0);
	const [gistLoc, setGistLoc] = useState<[number, number]>([0, 0]);
	const [themeName, setThemeName] = useState(() => resolveTheme(cfg.theme).name);
	const [minsToday, setMinsToday] = useState(0);
	const loggedIn = !!cfg.token;
	const {columns, rows} = useDimensions();
	const theme = resolveTheme(themeName);
	const claudeStatus = useClaudeStatus();
	const [blink, setBlink] = useState(true);
	useEffect(() => {
		if (claudeStatus?.state !== 'needs-input') {
			setBlink(true);
			return;
		}
		const id = setInterval(() => setBlink(b => !b), 600);
		return () => clearInterval(id);
	}, [claudeStatus?.state]);

	const screenRef = useRef(screen);
	screenRef.current = screen;
	const stRef = useRef(st);
	stRef.current = st;

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const c = await api.getContent();
				if (!alive) return;
				setContent(c);
				if (loggedIn) {
					try {
						const [s, p] = await Promise.all([api.getState(), api.me()]);
						if (!alive) return;
						setSt(s);
						setProfile(p);
					} catch (e) {
						if (!(e instanceof ApiError)) throw e;
					}
				}
			} catch (e) {
				if (alive) setError(String(e));
			}
		})();
		return () => {
			alive = false;
		};
	}, [api, loggedIn]);

	const navigate = useCallback((target: ScreenName) => {
		setHistory(h => [...h, screenRef.current]);
		setScreen(target);
	}, []);

	const back = useCallback(() => {
		setHistory(h => {
			if (h.length === 0) {
				setScreen('home');
				return h;
			}
			setScreen(h[h.length - 1]!);
			return h.slice(0, -1);
		});
	}, []);

	const nav: Nav = {
		go: navigate,
		back,
		openClimb: c => {
			setCamp(c);
			navigate('climb');
		},
		openQuiz: s => {
			setQuizStage(s);
			navigate('quiz');
		},
		openGist: (s, t) => {
			setGistLoc([s, t]);
			navigate('gist');
		},
	};

	// Track CLI usage: flush accumulated time periodically and keep "minutes today" live.
	useEffect(() => {
		usage.startSession();
		setMinsToday(usage.minutesToday());
		const id = setInterval(() => {
			usage.flush();
			setMinsToday(usage.minutesToday());
		}, 30_000);
		return () => {
			clearInterval(id);
			usage.flush();
		};
	}, []);

	const refreshState = useCallback((doc: State) => setSt(doc), []);

	// Record a check-in for today: minutes auto-filled from usage; summary optional and
	// preserved if not passed. Called on read-completion (auto) and manual summary save.
	const checkIn = useCallback(
		async (summary?: string) => {
			if (!loggedIn) return;
			usage.flush();
			setMinsToday(usage.minutesToday());
			const today = sel.todayIso();
			const existing = stRef.current.entries[today];
			try {
				const doc = await api.saveEntry({
					date: today,
					mins: String(usage.minutesToday()),
					summary: summary ?? existing?.summary ?? '',
				});
				setSt(doc);
			} catch {
				/* ignore */
			}
		},
		[api, loggedIn],
	);

	useInput((input, key) => {
		if (capture) return;
		if (key.escape) {
			back();
			return;
		}
		if (input === 'q' || (key.ctrl && input === 'c')) {
			exit();
			return;
		}
		if (input === 't') {
			setThemeName(n => {
				const nx = nextTheme(n);
				config.saveTheme(nx);
				return nx;
			});
			return;
		}
		const hit = NAV.find(n => n[1] === input);
		if (hit) navigate(hit[0]);
	});

	if (error) {
		return (
			<Box width={columns} height={rows} padding={1}>
				<Text color={theme.crit}>error: {error}</Text>
			</Box>
		);
	}
	if (!content) {
		return (
			<Box width={columns} height={rows} padding={1}>
				<Text color={theme.accent}>
					<Spinner type="dots" />
				</Text>
				<Text> loading clpr…</Text>
			</Box>
		);
	}

	const who = profile?.username || (loggedIn ? 'you' : 'anon');
	const strk = sel.streak(st);

	const shared = {content, st, api, nav, setCapture, refreshState, loggedIn, checkIn, minsToday};

	return (
		<ThemeContext.Provider value={theme}>
			<Box flexDirection="column" width={columns} height={rows} paddingX={2} paddingY={1}>
				<Box flexShrink={0} justifyContent="space-between">
					<Text>
						<Text color={theme.accent} bold>● clpr</Text>
						{claudeStatus && claudeStatus.state !== 'idle' && (
							<Text color="#ff8c00">{'  '}{blink ? '✻' : ' '} {STATE_LABEL[claudeStatus.state]}</Text>
						)}
					</Text>
					{loggedIn ? (
						<Text>
							<Text bold color={theme.info}>
								{who}
							</Text>
							{'   '}
							<Text color={theme.warn}>
								{ICON.streak} {strk}
							</Text>
						</Text>
					) : (
						<Text color={theme.warn}>read-only — run `clpr login`</Text>
					)}
				</Box>
				<Box flexShrink={0}>
					{NAV.map(([name, key, label]) => (
						<Text key={name}>
							<Text color={theme.muted} dimColor>
								{key}{' '}
							</Text>
							<Text color={screen === name ? theme.accent : theme.muted} bold={screen === name}>
								{label}
							</Text>
							{'    '}
						</Text>
					))}
				</Box>
				<Box flexShrink={0} marginBottom={1}>
					<Text color={theme.muted}>{'─'.repeat(Math.max(0, columns - 4))}</Text>
				</Box>

				<Box flexDirection="column" flexGrow={1} overflow="hidden">
					{screen === 'home' && <Home {...shared} />}
					{screen === 'climb' && <Climb {...shared} camp={camp} />}
					{screen === 'board' && <Board {...shared} />}
					{screen === 'notes' && <Notes {...shared} />}
					{screen === 'dashboard' && <Dashboard {...shared} profile={profile} />}
					{screen === 'quiz' && <Quiz {...shared} stage={quizStage} />}
					{screen === 'gist' && <Gist {...shared} loc={gistLoc} />}
				</Box>

				<Box flexShrink={0} marginTop={1}>
					<Text color={theme.muted} dimColor>
						1–4 sections · ↑↓ move · enter select · esc back · t theme:{theme.name} · q quit
					</Text>
				</Box>
			</Box>
		</ThemeContext.Provider>
	);
}

export type ScreenProps = {
	content: Content;
	st: State;
	api: Api;
	nav: Nav;
	setCapture: (b: boolean) => void;
	refreshState: (doc: State) => void;
	loggedIn: boolean;
	checkIn: (summary?: string) => void;
	minsToday: number;
};
