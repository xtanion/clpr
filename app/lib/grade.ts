import type { QNumeric, QCode, QFree } from "./data";

export type Grade = { pass: boolean; frac: number; msg: string };

function deepEqual(a: unknown, b: unknown, tol: number): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i], tol)) return false;
    return true;
  }
  if (typeof a === "number" && typeof b === "number") {
    if (!isFinite(a) || !isFinite(b)) return a === b;
    return Math.abs(a - b) <= (tol || 1e-6);
  }
  return a === b;
}

export function gradeNumeric(q: QNumeric, val: string): Grade {
  const num = parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return { pass: false, frac: 0, msg: "Enter a number." };
  const ok = Math.abs(num - q.answer) <= q.tolerance;
  return { pass: ok, frac: ok ? 1 : 0, msg: ok ? `Correct: ${q.answer}${q.unit ? " " + q.unit : ""}.` : "Not quite. Recompute and try again." };
}

export function gradeCode(q: QCode, code: string): Grade {
  let fn: unknown;
  try {
    fn = new Function('"use strict";' + code + "; return " + q.entry + ";")();
    if (typeof fn !== "function") return { pass: false, frac: 0, msg: `Could not find function ${q.entry}.` };
  } catch (e) {
    return { pass: false, frac: 0, msg: "Error: " + (e as Error).message };
  }
  const callable = fn as (...args: unknown[]) => unknown;
  let passed = 0;
  for (let i = 0; i < q.tests.length; i++) {
    const t = q.tests[i];
    const args = JSON.parse(JSON.stringify(t.args));
    let out: unknown;
    try { out = callable.apply(null, args); } catch (e2) {
      return { pass: false, frac: passed / q.tests.length, msg: `Test ${i + 1} threw: ${(e2 as Error).message}` };
    }
    if (deepEqual(out, t.expected, 1e-4)) passed++;
    else {
      const rest = t.args.length > 1 ? ", " + JSON.stringify(t.args.slice(1)) : "";
      return { pass: false, frac: passed / q.tests.length, msg: `Test ${i + 1} failed.\n  input: ${JSON.stringify(t.args[0])}${rest}\n  expected: ${JSON.stringify(t.expected)}\n  got: ${JSON.stringify(out)}` };
    }
  }
  return { pass: true, frac: 1, msg: `All ${q.tests.length} hidden tests passed.` };
}

export function gradeFree(q: QFree, text: string): Grade {
  const t = (text || "").toLowerCase();
  if (t.trim().split(/\s+/).filter(Boolean).length < 6) return { pass: false, frac: 0, msg: "Write at least a full sentence to be judged." };
  let hits = 0;
  q.keywords.forEach((k) => { if (t.indexOf(k.toLowerCase()) !== -1) hits++; });
  const frac = Math.min(1, hits / Math.min(3, q.keywords.length));
  const pass = frac >= 0.5;
  return {
    pass,
    frac,
    msg: `${pass ? "The judge accepts this answer" : "The judge wants more of the key ideas"}. Coverage ${Math.round(frac * 100)}%. This question carries reduced leaderboard weight by design.`,
  };
}

export function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r < 10 ? "0" : ""}${r}s`;
}
