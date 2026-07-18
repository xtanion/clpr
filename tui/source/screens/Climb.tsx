import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from '../TextInput.js';
import type {ScreenProps} from '../app.js';
import {ApiError} from '../api.js';
import * as sel from '../state.js';
import {useList} from '../useList.js';
import {useTheme, ICON} from '../theme.js';

const RES_MARK: Record<string, string> = {video: '▶', paper: '¶', read: '≡', code: '</>'};

export function Climb({content, st, api, nav, setCapture, refreshState, loggedIn, checkIn, camp}: ScreenProps & {camp: number}) {
	const theme = useTheme();
	const stage = content.roadmap[camp];
	const [msg, setMsg] = useState('');
	const [commentMode, setCommentMode] = useState(false);
	const [commentText, setCommentText] = useState('');

	const topics = stage?.topics ?? [];
	const hasQuiz = content.quizzes.some(q => q.stage === camp);
	// selectable items: topics, then quiz (if any)
	const itemCount = topics.length + (hasQuiz ? 1 : 0);
	const idx = useList(itemCount, !commentMode);

	const guard = () => {
		if (!loggedIn) {
			setMsg('read-only — run `clpr login`');
			return false;
		}
		return true;
	};

	const run = async (p: Promise<typeof st>) => {
		try {
			refreshState(await p);
			setMsg('');
		} catch (e) {
			setMsg(e instanceof ApiError ? `failed: ${e.message}` : String(e));
		}
	};

	const toggleTopic = async (i: number) => {
		const wasDone = sel.isTopicDone(st, camp, i);
		try {
			refreshState(await api.toggleProgress(camp, i));
			setMsg('');
			if (!wasDone) checkIn(); // completing a read auto-checks you in for today
		} catch (e) {
			setMsg(e instanceof ApiError ? `failed: ${e.message}` : String(e));
		}
	};

	useInput(
		(input, key) => {
			if (commentMode) return;
			const onQuiz = hasQuiz && idx === topics.length;
			if (key.return || input === ' ') {
				if (onQuiz) nav.openQuiz(camp);
				else if (guard()) void toggleTopic(idx);
			} else if (input === 'g' && !onQuiz) {
				const t = topics[idx];
				if (t?.gists?.modes?.length) nav.openGist(camp, idx);
				else setMsg('no gist for this topic');
			} else if (input === 'c') {
				if (guard()) {
					setCommentMode(true);
					setCapture(true);
				}
			}
		},
		{isActive: !commentMode},
	);

	useInput(
		(_i, key) => {
			if (key.escape) {
				setCommentMode(false);
				setCapture(false);
				setCommentText('');
			}
		},
		{isActive: commentMode},
	);

	if (!stage) return <Text color={theme.crit}>no camp selected</Text>;

	const key = `camp:${camp}`;
	const comments = st.comments[key] ?? [];

	return (
		<Box flexDirection="column">
			<Text color={theme.muted}>// camp {camp} · {stage.title}</Text>
			<Text bold>{stage.alt}</Text>
			<Text color={theme.muted}>{stage.blurb}</Text>
			<Box marginTop={1} flexDirection="column">
				{topics.map((t, i) => {
					const done = sel.isTopicDone(st, camp, i);
					const selected = i === idx;
					return (
						<Box key={i} flexDirection="column" marginBottom={1}>
							<Text>
								<Text color={theme.accent} bold>
									{selected ? ICON.pointer + ' ' : '  '}
								</Text>
								<Text color={done ? theme.accent : theme.muted}>{done ? '[x]' : '[ ]'}</Text>{' '}
								<Text color={selected ? theme.accent : undefined} bold={selected} strikethrough={done}>
									{t.label}
								</Text>
								{t.gists?.modes?.length ? <Text color={theme.muted}> · g:gist</Text> : null}
							</Text>
							{t.res.map((r, ri) => (
								<Text key={ri} color={theme.muted}>
									{'      '}
									{RES_MARK[r.type] ?? '-'} {r.label} <Text dimColor>{r.url}</Text>
								</Text>
							))}
						</Box>
					);
				})}
				{hasQuiz && (
					<Text
						color={idx === topics.length ? theme.accent : sel.clprCleared(st, camp) ? theme.muted : undefined}
						bold={idx === topics.length}
						strikethrough={sel.clprCleared(st, camp)}
					>
						{sel.clprCleared(st, camp)
							? `${idx === topics.length ? ICON.pointer + ' ' : '  '}${ICON.check} clpr cleared — retake`
							: `${idx === topics.length ? ICON.pointer + ' ' : '  '}${ICON.quiz} take the clpr (quiz)`}
					</Text>
				)}
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text color={theme.muted}>// comments (c to add)</Text>
				{comments.length === 0 && <Text dimColor>no comments yet</Text>}
				{comments.map(cm => (
					<Text key={cm.id}>
						<Text color={theme.accent}>{cm.author}</Text> <Text dimColor>{cm.at.slice(0, 10)}</Text> {cm.text}
					</Text>
				))}
				{commentMode && (
					<Box>
						<Text color={theme.accent}>{'> '}</Text>
						<TextInput
							value={commentText}
							onChange={setCommentText}
							onSubmit={() => {
								const text = commentText.trim();
								setCommentMode(false);
								setCapture(false);
								setCommentText('');
								if (text) void run(api.addComment(key, text));
							}}
						/>
					</Box>
				)}
			</Box>

			{msg && <Text color={theme.warn}>{msg}</Text>}
			<Text color={theme.muted} dimColor>
				space/enter toggle · g gist · c comment
			</Text>
		</Box>
	);
}
