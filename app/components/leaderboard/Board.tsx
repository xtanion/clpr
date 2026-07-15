"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { api } from "@/lib/api";
import type { Stage } from "@/lib/data";
import { useContent } from "@/lib/content";
import { useClpr, totalXp, type State, type BoardRow } from "@/lib/store";
import { fmtTime } from "@/lib/grade";

type View = "world" | "races";
const TABS: { id: View; label: string }[] = [
  { id: "world", label: "world" },
  { id: "races", label: "per-topic races" },
];
const tabIndex = (v: View) => TABS.findIndex((t) => t.id === v);

const DISTANCE = 64;

type RaceRow = { name: string; handle: string; ms: number; score: number; me: boolean };

function stageLabel(roadmap: Stage[], n: number) {
  if (n <= 0) return "Base camp";
  return roadmap[Math.min(n, roadmap.length) - 1].alt;
}

function Row({ r }: { r: BoardRow }) {
  const { roadmap } = useContent();
  return (
    <div className={`row${r.me ? " me" : ""}`}>
      <span className={`rank${r.rank <= 1 ? " top" : ""} tnum`}>{r.rank}</span>
      <div className="who">
        <span className="nm">{r.name}{r.me && <span className="youtag">that is you</span>}</span>
        <span className="sub">@{r.handle}</span>
      </div>
      <span className="metric xp tnum">{r.xp.toLocaleString()} <small>XP</small></span>
      <span className="metric col-stage" style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)" }}>{stageLabel(roadmap, r.stage)}</span>
      <span className="streak-cell tnum">{r.streak}d</span>
    </div>
  );
}

function Head() {
  return (
    <div className="row head">
      <span>Rank</span><span>Climber</span><span>XP</span><span className="col-stage">Stage</span><span>Streak</span>
    </div>
  );
}

export function Board() {
  const s = useClpr();
  const [view, setView] = useState<View>("world");
  // Direction of the last tab switch, computed at click time (not from a ref during
  // render): a tab further right enters from the right, further left from the left —
  // matching the page-level nav transitions.
  const [dir, setDir] = useState(1);
  const reduce = useReducedMotion();

  const go = (next: View) => {
    if (next === view) return;
    setDir(tabIndex(next) >= tabIndex(view) ? 1 : -1);
    setView(next);
  };

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${view === t.id ? " active" : ""}`} onClick={() => go(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={{ overflowX: "clip" }}>
        <motion.div
          key={view}
          initial={reduce ? false : { x: dir * DISTANCE, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === "world" ? <World s={s} /> : <Races s={s} />}
        </motion.div>
      </div>
    </>
  );
}

function World({ s }: { s: State }) {
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const xp = totalXp(s); // refetch after the user earns XP so their row stays current

  useEffect(() => {
    let alive = true;
    api.getLeaderboard<BoardRow[]>()
      .then((b) => { if (alive) { setBoard(b); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [xp]);

  if (failed) return <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>Could not load the leaderboard.</p>;
  if (!board) return <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>loading</p>;

  const top = board.slice(0, 10);
  const meRow = board.find((r) => r.me);
  const meInTop = meRow ? meRow.rank <= 10 : true;

  return (
    <>
      <div className="board">
        <Head />
        {top.map((r) => <Row key={r.handle} r={r} />)}
        {meRow && !meInTop && (
          <>
            <div className="row gap"><span className="rank sev-dim">...</span></div>
            <Row r={meRow} />
          </>
        )}
      </div>
      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        {board.length.toLocaleString()} {board.length === 1 ? "climber" : "climbers"} registered.
        {meRow ? ` You are #${meRow.rank}.` : ""}
      </p>
    </>
  );
}

function Races({ s }: { s: State }) {
  const { roadmap, quizzes } = useContent();
  const [races, setRaces] = useState<Record<string, RaceRow[]> | null>(null);
  const [failed, setFailed] = useState(false);
  const xp = totalXp(s); // refetch after the user earns XP so a new best time appears

  useEffect(() => {
    let alive = true;
    api.getRaces<Record<string, RaceRow[]>>()
      .then((r) => { if (alive) { setRaces(r); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [xp]);

  if (failed) return <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>Could not load the races.</p>;
  if (!races) return <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>loading</p>;

  // Show every stage that has a clpr quiz, even before anyone has cleared it.
  const stages = [...new Set(quizzes.map((q) => q.stage))].sort((a, b) => a - b);

  return (
    <>
      <div className="race-grid">
        {stages.map((st) => {
          const meta = roadmap[st];
          const runners = races[String(st)] || [];
          return (
            <div key={st} className="race">
              <div className="kicker c-scroll" style={{ fontSize: 13 }}>Race to clear</div>
              <h4>{meta.title}</h4>
              <div className="rmeta">{meta.alt} . ranked by score, then time</div>
              {runners.map((r, i) => (
                <div key={r.handle + i} className={`race-row${i === 0 ? " win" : ""}`}>
                  <span className="nm">{i + 1}. {r.name}{r.me ? " (you)" : ""}</span>
                  <span className="t tnum">{Math.round(r.score * 100)}% . {fmtTime(r.ms)}</span>
                </div>
              ))}
              {runners.length === 0 && (
                <div className="race-row"><span className="t">No climbers have cleared this stage yet.</span></div>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 24, fontSize: 15 }}>
        Racers face the same versioned question bank, so difficulty is equal. Fastest high score wins the topic.
      </p>
    </>
  );
}
