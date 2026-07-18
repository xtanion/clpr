import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import type {ScreenProps} from '../app.js';
import type {GistDoc} from '../api.js';
import {ApiError} from '../api.js';
import {renderMarkdown} from '../markdown.js';
import {useTheme} from '../theme.js';

// A single gist per concept (all reads are <5 min). Prefer the 5-minute body, then
// fall back through the other lengths if that mode wasn't generated.
const PICK = ['5min', '2min', '30s', 'deep', 'cheatsheet'];

export function Gist({content, api, loc}: ScreenProps & {loc: [number, number]}) {
	const theme = useTheme();
	const [stage, topic] = loc;
	const [doc, setDoc] = useState<GistDoc | null>(null);
	const [err, setErr] = useState('');

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const d = await api.getGists(stage, topic);
				if (alive) setDoc(d);
			} catch (e) {
				if (alive) setErr(e instanceof ApiError ? `gist unavailable (${e.status})` : String(e));
			}
		})();
		return () => {
			alive = false;
		};
	}, [api, stage, topic]);

	const modeKey = doc ? PICK.find(m => m in doc.modes) ?? Object.keys(doc.modes)[0] : undefined;
	const body = doc && modeKey ? doc.modes[modeKey]!.body : '';
	const label = content.roadmap[stage]?.topics[topic]?.label ?? 'concept';

	return (
		<Box flexDirection="column">
			<Text color={theme.muted}>// gist · {label}</Text>
			{err ? <Text color={theme.crit}>{err}</Text> : null}
			{!doc && !err ? (
				<Text color={theme.accent}>
					<Spinner type="dots" /> <Text color={theme.muted}>loading gist…</Text>
				</Text>
			) : null}
			{doc && !modeKey ? <Text color={theme.warn}>No gist generated for this concept yet.</Text> : null}
			{doc && modeKey ? (
				<Box marginTop={1}>
					<Text>{renderMarkdown(body, theme)}</Text>
				</Box>
			) : null}
		</Box>
	);
}
