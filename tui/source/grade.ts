// Client-side quiz grading, ported from app/lib/grade.ts. numeric/free are re-graded
// server-side on submit; code questions run in-process via `new Function` (Node),
// exactly like the web runs them in-browser.

import type {Question} from './types.js';

export type Grade = {pass: boolean; frac: number; msg: string};

function deepEqual(a: unknown, b: unknown, tol: number): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i], tol)) return false;
		return true;
	}
	if (typeof a === 'number' && typeof b === 'number') {
		if (!isFinite(a) || !isFinite(b)) return a === b;
		return Math.abs(a - b) <= (tol || 1e-6);
	}
	return a === b;
}

function gradeNumeric(q: Question, val: string): Grade {
	const num = parseFloat(String(val).replace(/,/g, ''));
	if (isNaN(num)) return {pass: false, frac: 0, msg: 'Enter a number.'};
	const ok = Math.abs(num - (q.answer ?? NaN)) <= (q.tolerance ?? 0);
	return {
		pass: ok,
		frac: ok ? 1 : 0,
		msg: ok
			? `Correct: ${q.answer}${q.unit ? ' ' + q.unit : ''}.`
			: 'Not quite. Recompute and try again.',
	};
}

function gradeCode(q: Question, code: string): Grade {
	const tests = q.tests ?? [];
	let fn: unknown;
	try {
		// eslint-disable-next-line no-new-func
		fn = new Function('"use strict";' + code + '; return ' + q.entry + ';')();
		if (typeof fn !== 'function')
			return {pass: false, frac: 0, msg: `Could not find function ${q.entry}.`};
	} catch (e) {
		return {pass: false, frac: 0, msg: 'Error: ' + (e as Error).message};
	}
	const callable = fn as (...args: unknown[]) => unknown;
	let passed = 0;
	for (let i = 0; i < tests.length; i++) {
		const t = tests[i]!;
		const args = JSON.parse(JSON.stringify(t.args));
		let out: unknown;
		try {
			out = callable.apply(null, args);
		} catch (e2) {
			return {pass: false, frac: passed / tests.length, msg: `Test ${i + 1} threw: ${(e2 as Error).message}`};
		}
		if (deepEqual(out, t.expected, 1e-4)) passed++;
		else
			return {
				pass: false,
				frac: passed / tests.length,
				msg: `Test ${i + 1} failed. expected ${JSON.stringify(t.expected)} got ${JSON.stringify(out)}`,
			};
	}
	return {pass: true, frac: 1, msg: `All ${tests.length} hidden tests passed.`};
}

function gradeFree(q: Question, text: string): Grade {
	const t = (text || '').toLowerCase();
	if (t.trim().split(/\s+/).filter(Boolean).length < 6)
		return {pass: false, frac: 0, msg: 'Write at least a full sentence to be judged.'};
	const keywords = q.keywords ?? [];
	let hits = 0;
	keywords.forEach(k => {
		if (t.indexOf(k.toLowerCase()) !== -1) hits++;
	});
	const frac = keywords.length ? Math.min(1, hits / Math.min(3, keywords.length)) : 0;
	const pass = frac >= 0.5;
	return {
		pass,
		frac,
		msg: `${pass ? 'The judge accepts this answer' : 'The judge wants more of the key ideas'}. Coverage ${Math.round(frac * 100)}%. This question carries reduced leaderboard weight by design.`,
	};
}

export function grade(q: Question, value: string): Grade {
	if (q.type === 'numeric') return gradeNumeric(q, value);
	if (q.type === 'code') return gradeCode(q, value);
	return gradeFree(q, value);
}
