import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import type {ScreenProps} from '../app.js';
import {ApiError} from '../api.js';
import {useList} from '../useList.js';
import {useTheme, ICON} from '../theme.js';

export function Notes({st, api, refreshState, loggedIn}: ScreenProps) {
	const theme = useTheme();
	const [msg, setMsg] = useState('');
	const dates = Object.keys(st.entries).sort().reverse();
	const idx = useList(dates.length);

	useInput(async (input, _key) => {
		if (input === 'd' && loggedIn && dates[idx]) {
			try {
				refreshState(await api.deleteEntry(dates[idx]!));
				setMsg('');
			} catch (e) {
				setMsg(e instanceof ApiError ? `failed: ${e.message}` : String(e));
			}
		}
	});

	if (dates.length === 0)
		return (
			<Box flexDirection="column">
				<Text color={theme.muted}>// notes</Text>
				<Text dimColor>no journal entries yet — check in from the dashboard</Text>
			</Box>
		);

	return (
		<Box flexDirection="column">
			<Text color={theme.muted}>// notes ({loggedIn ? 'd to delete selected' : 'read-only'})</Text>
			{dates.map((d, i) => {
				const e = st.entries[d]!;
				return (
					<Box key={d} flexDirection="column" marginTop={1}>
						<Text>
							<Text color={theme.accent} bold>
								{i === idx ? ICON.pointer + ' ' : '  '}
							</Text>
							<Text bold color={i === idx ? theme.accent : undefined}>
								{d}
							</Text>
							{'  '}
							<Text color={theme.muted}>
								{e.mins || '0'} min
							</Text>
						</Text>
						{e.summary ? <Text color={theme.accent}>{'    '}{e.summary}</Text> : null}
					</Box>
				);
			})}
			{msg && <Text color={theme.warn}>{msg}</Text>}
		</Box>
	);
}
