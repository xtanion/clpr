"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Question, QNumeric, QCode, QFree, Stage } from "@/lib/data";
import { useContent } from "@/lib/content";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { useHydrated, useClpr, stageTopicsComplete, clprCleared, recordAttempt, PASS, type Attempt } from "@/lib/store";
import { gradeNumeric, gradeCode, gradeFree, fmtTime, type Grade } from "@/lib/grade";

type Stored = { grade: Grade; pass: boolean; frac: number; val: string };

function typeName(t: Question["type"]) {
  return t === "code" ? "Code + hidden tests" : t === "numeric" ? "Numeric" : "Free response";
}

export function Quiz() {
  const params = useSearchParams();
  const stage = parseInt(params.get("stage") || "", 10);
  const hydrated = useHydrated();
  const s = useClpr();
  const reduce = useReducedMotion();
  const { roadmap, quizzes } = useContent();

  const quiz = useMemo(() => quizzes.find((q) => q.stage === stage), [stage, quizzes]);
  const meta = roadmap[stage];
  const qs = quiz?.questions ?? [];

  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<(Stored | null)[]>(() => qs.map(() => null));
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [summit, setSummit] = useState<{ attempt: Attempt; score: number } | null>(null);
  const startTime = useRef(Date.now());

  if (!quiz || !meta) {
    return (
      <Gate title="That stage has no clpr yet." eyebrow="No quiz" />
    );
  }
  if (hydrated && !stageTopicsComplete(s, stage) && !clprCleared(s, stage)) {
    return <Gate title={`Finish all four topics in ${meta.alt} first.`} eyebrow="Locked" />;
  }

  const q = qs[current];

  function valueFor(i: number, fallback: string) {
    if (inputs[i] !== undefined) return inputs[i];
    if (results[i]) return results[i]!.val;
    return fallback;
  }
  const setValue = (i: number, v: string) => setInputs((m) => ({ ...m, [i]: v }));

  function check() {
    let grade: Grade;
    let val: string;
    if (q.type === "numeric") {
      val = valueFor(current, "");
      grade = gradeNumeric(q as QNumeric, val);
    } else if (q.type === "code") {
      val = valueFor(current, (q as QCode).signature);
      grade = gradeCode(q as QCode, val);
    } else {
      val = valueFor(current, "");
      grade = gradeFree(q as QFree, val);
    }
    setResults((r) => { const n = [...r]; n[current] = { grade, pass: grade.pass, frac: grade.frac, val }; return n; });
  }

  function next() {
    if (current < qs.length - 1) setCurrent((c) => c + 1);
    else void finish().catch(() => {});
  }

  async function finish() {
    // The server re-grades numeric/free authoritatively and computes XP; we send
    // each response (raw value + client-computed frac/pass for code).
    const responses = qs.map((_, i) => {
      const r = results[i];
      return { index: i, value: r?.val ?? "", frac: r?.frac ?? 0, pass: r?.pass ?? false, msg: r?.grade.msg ?? "" };
    });
    const res = await recordAttempt(stage, responses, Date.now() - startTime.current);
    setSummit({ attempt: res.attempt, score: res.score });
  }

  function retry() {
    setResults(qs.map(() => null));
    setInputs({});
    setCurrent(0);
    startTime.current = Date.now();
    setSummit(null);
  }

  if (summit) return <Summit summit={summit} meta={meta} stage={stage} onRetry={retry} />;

  const prior = results[current];
  const nextDisabled = !(prior && prior.pass);

  return (
    <>
      <div className="q-progress">
        {qs.map((_, i) => (
          <div key={i} className={`q-tick${results[i]?.pass ? " on" : i === current ? " cur" : ""}`} />
        ))}
      </div>
      <p className="eyebrow" style={{ marginBottom: 14 }}>Clpr . {meta.alt} . Question {current + 1} of {qs.length}</p>

      <motion.div
        key={current}
        className="q-card"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="q-type">
          <span>{typeName(q.type)}</span>
          <span className={`q-weight ${q.weight === "full" ? "full" : "reduced"}`}>{q.weight === "full" ? "full XP" : "reduced XP"}</span>
        </div>
        <div className="q-prompt">{q.prompt}</div>

        {q.type === "numeric" && (
          <>
            <div className="field" style={{ maxWidth: 320, marginTop: 24 }}>
              <input type="text" value={valueFor(current, "")} placeholder={`Your answer${(q as QNumeric).unit ? " in " + (q as QNumeric).unit : ""}`} onChange={(e) => setValue(current, e.target.value)} />
            </div>
            <p className="q-hint">{(q as QNumeric).hint}</p>
          </>
        )}

        {q.type === "code" && (
          <>
            <textarea className="code-input" spellCheck={false} value={valueFor(current, (q as QCode).signature)} onChange={(e) => setValue(current, e.target.value)} />
            <p className="q-hint">Write a JavaScript function. It runs against hidden tests in your browser.</p>
          </>
        )}

        {q.type === "free" && (
          <>
            <div className="field" style={{ marginTop: 24 }}>
              <textarea rows={4} value={valueFor(current, "")} placeholder="Two sentences. Be specific." onChange={(e) => setValue(current, e.target.value)} />
            </div>
            <div className="rubric">The judge looks for:
              <ul>{(q as QFree).rubric.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          </>
        )}

        {prior && (
          <div className={`q-result ${prior.grade.pass ? "pass" : "fail"}`}>{prior.grade.msg}</div>
        )}

        <div className="q-actions">
          <ArrowLink onClick={check}>Check answer</ArrowLink>
          {current > 0 && <ArrowLink onClick={() => setCurrent((c) => c - 1)} arrow={false} className="ghost">Back</ArrowLink>}
          <ArrowLink onClick={next} disabled={nextDisabled}>{current === qs.length - 1 ? "Finish" : "Next"}</ArrowLink>
        </div>
        <div style={{ marginTop: 20 }}>
          <Link className="leave-quiz" href="/climb">Leave quiz</Link>
        </div>
      </motion.div>
    </>
  );
}

function Gate({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="h-sm" style={{ marginTop: 12 }}>{title}</h1>
      <div style={{ marginTop: 24 }}><ArrowLink href="/climb">Back to the climb</ArrowLink></div>
    </div>
  );
}

function Summit({ summit, meta, stage, onRetry }: { summit: { attempt: Attempt; score: number }; meta: Stage; stage: number; onRetry: () => void }) {
  const { attempt, score } = summit;
  const { roadmap } = useContent();
  const isSummit = stage === roadmap.length - 1;
  const reduce = useReducedMotion();
  return (
    <motion.div className="q-summit" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      {attempt.passed ? (
        <>
          <p className="eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>{attempt.firstClear ? "First clear" : "Cleared again"}</p>
          <div className="xp-big tnum">+{attempt.xp} XP</div>
          <h1 className="h-sm" style={{ marginTop: 12 }}>{meta.alt} {isSummit ? "summited." : "cleared."}</h1>
          <p className="lead" style={{ margin: "16px auto 0", textAlign: "center" }}>
            Scored {Math.round(score * 100)}% in {fmtTime(attempt.timeMs)}.{attempt.firstClear ? " First-clear bonus applied." : ""}
          </p>
          <div style={{ marginTop: 32, display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            <ArrowLink href="/leaderboard" className="c-post on">See the board</ArrowLink>
            <ArrowLink href="/climb" arrow={false} className="ghost">Back to the climb</ArrowLink>
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>Not this time</p>
          <h1 className="h-sm" style={{ marginTop: 12 }}>Scored {Math.round(score * 100)}%. The bar is {Math.round(PASS * 100)}%.</h1>
          <p className="lead" style={{ margin: "16px auto 0", textAlign: "center" }}>
            No XP minted. Every objective question must pass. Review, then run it back.
          </p>
          <div style={{ marginTop: 32, display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            <ArrowLink onClick={onRetry}>Retry the clpr</ArrowLink>
            <ArrowLink href="/climb" arrow={false} className="ghost">Back to the climb</ArrowLink>
          </div>
        </>
      )}
    </motion.div>
  );
}
