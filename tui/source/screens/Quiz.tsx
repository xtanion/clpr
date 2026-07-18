import React, {useEffect, useState} from 'react';
import {Box, Text, useInput, useStdin} from 'ink';
import TextInput from '../TextInput.js';
import type {ScreenProps} from '../app.js';
import {ApiError} from '../api.js';
import {grade} from '../grade.js';
import {useTheme} from '../theme.js';
import {editInEditor} from '../editor.js';

export function Quiz({content, api, nav, setCapture, refreshState, loggedIn, stage}: ScreenProps & {stage: number}) {
	const theme = useTheme();
	const {setRawMode} = useStdin();
	const quiz = content.quizzes.find(q => q.stage === stage);
	const questions = quiz?.questions ?? [];
	const [cur, setCur] = useState(0);
	const [answers, setAnswers] = useState<string[]>(() =>
		questions.map(q => (q.type === 'code' ? q.signature ?? '' : '')),
	);
	const [phase, setPhase] = useState<'answer' | 'result'>('answer');
	const [result, setResult] = useState<{score: number; passed: boolean; xp: number; lines: string[]} | null>(null);
	const [startedAt] = useState(() => Date.now());
	const [msg, setMsg] = useState('');

	useEffect(() => {
		setCapture(true);
		return () => setCapture(false);
	}, [setCapture]);

	// During answering, capture is on (global nav is suppressed), so handle esc here.
	// In the result phase, the global handler takes over.
	useInput(
		(_i, key) => {
			if (key.escape) {
				setCapture(false);
				nav.back();
				return;
			}
			const cq = questions[cur];
			if (cq?.type === 'code' && key.return) {
				const code = editInEditor(answers[cur] || cq.signature || '', setRawMode);
				const next = [...answers];
				next[cur] = code;
				setAnswers(next);
				advance();
			}
		},
		{isActive: phase === 'answer'},
	);

	if (!quiz) return <Text color={theme.crit}>no quiz for this camp</Text>;

	const submit = async () => {
		const responses = questions.map((q, i) => {
			const g = grade(q, answers[i] ?? '');
			return {index: i, value: answers[i] ?? '', frac: g.frac, pass: g.pass, msg: g.msg};
		});
		const lines = responses.map(
			(r, i) => `Q${i + 1} ${r.pass ? '✓' : '✗'} — ${r.msg}`,
		);
		try {
			const res = await api.attempt(stage, responses, Date.now() - startedAt);
			try {
				refreshState(await api.getState());
			} catch {
				/* ignore */
			}
			setResult({score: res.score, passed: res.passed, xp: res.attempt.xp, lines});
			setPhase('result');
			setCapture(false);
		} catch (e) {
			setMsg(e instanceof ApiError ? `submit failed: ${e.message}` : String(e));
		}
	};

	const advance = () => {
		if (cur < questions.length - 1) setCur(cur + 1);
		else void submit();
	};

	if (phase === 'result' && result) {
		return (
			<Box flexDirection="column">
				<Text color={theme.muted}>// clpr result</Text>
				<Text>
					score {Math.round(result.score * 100)}%{'   '}
					{result.passed ? (
						<Text color={theme.accent} bold>
							SUMMITED · +{result.xp} xp
						</Text>
					) : (
						<Text color={theme.warn}>not cleared yet</Text>
					)}
				</Text>
				<Box flexDirection="column" marginTop={1}>
					{result.lines.map((l, i) => (
						<Text key={i} color={l.includes('✓') ? theme.accent : theme.crit}>
							{l}
						</Text>
					))}
				</Box>
				<Text color={theme.muted} dimColor>
					press a nav key to leave
				</Text>
			</Box>
		);
	}

	if (!loggedIn) {
		return (
			<Box flexDirection="column">
				<Text color={theme.muted}>// clpr</Text>
				<Text color={theme.warn}>Sign in to take the quiz — run `clpr login`. (esc to go back)</Text>
			</Box>
		);
	}

	const q = questions[cur]!;
	return (
		<Box flexDirection="column">
			<Text color={theme.muted}>
				// clpr · {content.roadmap[stage]?.alt ?? `stage ${stage}`} ·{' '}
				<Text color={theme.info}>
					Q{cur + 1}/{questions.length}
				</Text>
			</Text>
			<Text>
				<Text color={theme.info} bold>
					Q{cur + 1}.
				</Text>{' '}
				{q.prompt}
				{q.weight !== 'full' ? <Text color={theme.warn}> (reduced weight)</Text> : null}
			</Text>
			{q.hint ? <Text dimColor>hint: {q.hint}</Text> : null}
			{q.type === 'numeric' && q.unit ? <Text dimColor>unit: {q.unit}</Text> : null}
			{q.type === 'code' ? (
				<Box flexDirection="column">
					<Text color={theme.muted}>{q.signature}</Text>
					<Box>
						<Text color={theme.accent}>{'> '}</Text>
						{answers[cur] && answers[cur] !== q.signature ? (
							<Text color={theme.info}>{answers[cur]!.split('\n')[0]} …</Text>
						) : (
							<Text dimColor>press enter to write your function in $EDITOR</Text>
						)}
					</Box>
				</Box>
			) : (
				<Box>
					<Text color={theme.accent}>{'> '}</Text>
					<TextInput
						value={answers[cur] ?? ''}
						onChange={v => {
							const next = [...answers];
							next[cur] = v;
							setAnswers(next);
						}}
						onSubmit={advance}
					/>
				</Box>
			)}
			<Text color={theme.muted} dimColor>
				{q.type === 'code' ? 'enter = edit in $EDITOR' : `enter = ${cur < questions.length - 1 ? 'next' : 'submit'}`} · esc = back
			</Text>
			{msg && <Text color={theme.warn}>{msg}</Text>}
		</Box>
	);
}
