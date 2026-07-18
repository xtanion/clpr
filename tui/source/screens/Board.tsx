import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import type {ScreenProps} from '../app.js';
import type {BoardRow, RaceRow} from '../types.js';
import {useTheme} from '../theme.js';

export function Board({content, api, loggedIn}: ScreenProps) {
	const theme = useTheme();
	const [board, setBoard] = useState<BoardRow[] | null>(null);
	const [races, setRaces] = useState<Record<string, RaceRow[]>>({});
	const [err, setErr] = useState('');

	useEffect(() => {
		if (!loggedIn) return;
		let alive = true;
		(async () => {
			try {
				const [b, r] = await Promise.all([api.getLeaderboard(), api.getRaces()]);
				if (!alive) return;
				setBoard(b);
				setRaces(r);
			} catch (e) {
				if (alive) setErr(String(e));
			}
		})();
		return () => {
			alive = false;
		};
	}, [api, loggedIn]);

	if (!loggedIn)
		return (
			<Box flexDirection="column">
				<Text color={theme.muted}>// board</Text>
				<Text color={theme.warn}>Sign in to see the leaderboard — run `clpr login`.</Text>
			</Box>
		);
	if (err) return <Text color={theme.crit}>{err}</Text>;
	if (!board)
		return (
			<Text color={theme.accent}>
				<Spinner type="dots" /> <Text color={theme.muted}>loading board…</Text>
			</Text>
		);

	const col = (s: string, w: number) => (s + ' '.repeat(w)).slice(0, w);

	return (
		<Box flexDirection="column">
			<Text color={theme.muted}>// world ranking</Text>
			<Text color={theme.muted}>
				{col('#', 4)}
				{col('climber', 20)}
				{col('xp', 8)}
				{col('stage', 7)}
				streak
			</Text>
			{board.map(row => (
				<Text key={row.rank} color={row.me ? theme.accent : undefined} bold={row.me}>
					{col(String(row.rank), 4)}
					{col(row.name + (row.me ? ' (you)' : ''), 20)}
					{col(String(row.xp), 8)}
					{col(String(row.stage), 7)}
					{row.streak}
				</Text>
			))}

			<Box marginTop={1} flexDirection="column">
				<Text color={theme.muted}>// races</Text>
				{Object.keys(races).length === 0 && <Text dimColor>no race times yet</Text>}
				{Object.keys(races)
					.sort((a, b) => Number(a) - Number(b))
					.map(stage => {
						const camp = content.roadmap[Number(stage)]?.alt ?? `stage ${stage}`;
						return (
							<Box key={stage} flexDirection="column">
								<Text bold>{camp}</Text>
								{races[stage]!.map((r, i) => (
									<Text key={i} color={r.me ? theme.accent : undefined}>
										{'  '}
										{i + 1}. {r.name}
										{r.me ? ' (you)' : ''} <Text color={theme.muted}>
											{Math.floor(r.ms / 60000)}m {String(Math.floor((r.ms % 60000) / 1000)).padStart(2, '0')}s ·{' '}
											{Math.round(r.score * 100)}%
										</Text>
									</Text>
								))}
							</Box>
						);
					})}
			</Box>
		</Box>
	);
}
