import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from '../TextInput.js';
import type {ScreenProps} from '../app.js';
import type {Profile} from '../types.js';
import * as sel from '../state.js';
import {useTheme, type Theme} from '../theme.js';

// Heatmap intensity from minutes used that day.
function heatColor(mins: number, theme: Theme): {color: string; dim?: boolean; bold?: boolean} {
	if (mins <= 0) return {color: theme.muted, dim: true};
	if (mins >= 60) return {color: theme.accent, bold: true};
	if (mins >= 30) return {color: theme.accent};
	return {color: theme.accent, dim: true};
}

export function Dashboard({
	content,
	st,
	setCapture,
	loggedIn,
	profile,
	checkIn,
	minsToday,
}: ScreenProps & {profile: Profile | null}) {
	const theme = useTheme();
	const today = sel.todayIso();
	const [editing, setEditing] = useState(false);
	const [summary, setSummary] = useState(st.entries[today]?.summary ?? '');
	const [msg, setMsg] = useState('');

	useInput((input, key) => {
		if (!editing) {
			if (input === 'e' && loggedIn) {
				setEditing(true);
				setCapture(true);
			}
			return;
		}
		if (key.escape) {
			setEditing(false);
			setCapture(false);
		}
	});

	// heatmap: last 12 weeks (7 rows x 12 cols), colored by minutes logged
	const todayDate = new Date();
	const oldest = new Date(todayDate);
	oldest.setDate(oldest.getDate() - 83);
	const rows: React.ReactNode[] = [];
	for (let r = 0; r < 7; r++) {
		const cells: React.ReactNode[] = [];
		for (let c = 0; c < 12; c++) {
			const d = new Date(oldest);
			d.setDate(d.getDate() + c * 7 + r);
			if (d > todayDate) {
				cells.push(<Text key={c}> </Text>);
				continue;
			}
			const e = st.entries[d.toISOString().slice(0, 10)];
			const mins = e ? parseInt(e.mins || '0', 10) || 0 : 0;
			const hc = heatColor(mins, theme);
			cells.push(
				<Text key={c} color={hc.color} dimColor={hc.dim} bold={hc.bold}>
					■
				</Text>,
			);
		}
		rows.push(<Box key={r}>{cells}</Box>);
	}

	const obj = sel.nextObjective(content, st);
	const who = profile?.name || 'climber';

	return (
		<Box flexDirection="column">
			<Text color={theme.muted}>// dashboard</Text>
			<Text bold>Welcome back, {who}.</Text>
			<Text color={theme.muted}>
				<Text color={theme.accent}>{sel.engineerTitle(content, st)}</Text> · {sel.totalXp(st)} xp · stage{' '}
				{sel.highestStageCleared(content, st)} · <Text color={theme.info}>{minsToday} min today</Text>
			</Text>
			<Text>
				<Text color={theme.muted}>next:</Text> {obj.label}
				{obj.camp ? <Text dimColor> ({obj.camp})</Text> : null}
			</Text>

			<Box marginTop={1} flexDirection="column">
				<Text color={theme.muted}>
					// activity · {sel.daysLogged(st)} days · {sel.streak(st)}d streak
				</Text>
				{rows}
				<Text>
					<Text color={theme.muted}>less </Text>
					<Text color={theme.muted} dimColor>■</Text>
					<Text color={theme.accent} dimColor>■</Text>
					<Text color={theme.accent}>■</Text>
					<Text color={theme.accent} bold>■</Text>
					<Text color={theme.muted}> more</Text>
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				{!loggedIn ? (
					<Text color={theme.warn}>Sign in to track activity — run `clpr login`.</Text>
				) : editing ? (
					<Box flexDirection="column">
						<Text color={theme.muted}>// today's summary ({minsToday} min · enter to save, esc to cancel)</Text>
						<Box>
							<Text color={theme.accent}>{'> '}</Text>
							<TextInput
								value={summary}
								onChange={setSummary}
								onSubmit={() => {
									setEditing(false);
									setCapture(false);
									checkIn(summary);
									setMsg('checked in');
								}}
							/>
						</Box>
					</Box>
				) : (
					<Text color={theme.muted}>
						// check-in is automatic when you finish a read · press <Text color={theme.accent}>e</Text> to add
						today's summary
					</Text>
				)}
				{st.entries[today]?.summary ? (
					<Text>
						<Text color={theme.muted}>today: </Text>
						{st.entries[today]!.summary}
					</Text>
				) : null}
			</Box>
			{msg && <Text color={theme.warn}>{msg}</Text>}
		</Box>
	);
}
