"use client";

import Link from "next/link";
import { type Track, weekKey } from "@/lib/track";
import { useClpr, useHydrated, isTopicDone, toggleTopic, stageTopicsComplete, clprCleared, bestAttempt, campUnlocked } from "@/lib/store";
import { useContent } from "@/lib/content";
import { WeekComments } from "./WeekComments";
import { ResLink } from "@/components/ui/ResLink";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Hammer, Lock, BookOpen } from "@/components/ui/icons";

function fmtRange(startIso: string, weekIndex: number) {
  if (!startIso) return "";
  const start = new Date(startIso + "T00:00:00");
  start.setDate(start.getDate() + weekIndex * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, o)} to ${end.toLocaleDateString(undefined, o)}`;
}

export function WeekView({ track, weekIndex }: { track: Track; weekIndex: number }) {
  const s = useClpr();
  const hydrated = useHydrated();
  const { roadmap } = useContent();
  const wk = track.weeks[weekIndex];
  const range = hydrated ? fmtRange(s.startDate, wk.index) : "";

  const unlocked = !hydrated || campUnlocked(s, wk.campId);
  const complete = hydrated && stageTopicsComplete(s, wk.campId);
  const cleared = hydrated && clprCleared(s, wk.campId);
  const best = cleared ? bestAttempt(s, wk.campId) : null;

  let clprStatus = "clear all four topics in this camp to unlock";
  if (cleared && best) clprStatus = `cleared at ${Math.round(best.score * 100)}%, ${best.xp} xp`;
  else if (complete) clprStatus = "camp complete, the clpr is open";

  const prevCamp = wk.campId > 0 ? roadmap[wk.campId - 1].alt : "";

  return (
    <div className="week-view">
      <div className="week-head">
        <span className="week-camp">{wk.campAlt}</span>
        <span className="week-no">week {wk.weekNo}</span>
        {range && <span className="week-range tnum">{range}</span>}
      </div>
      <p className="week-title muted">{wk.campTitle}</p>

      {!unlocked ? (
        <div className="week-locked">
          <div className="wl-title"><Lock size={13} />Locked</div>
          <div className="wl-sub">Finish <b>{prevCamp}</b> to unlock this camp.</div>
          <ArrowLink href={`/climb?topic=${track.id}&camp=${wk.campId - 1}`}>go to {prevCamp}</ArrowLink>
        </div>
      ) : (
      <>
      <div className="week-topics">
        {wk.topics.map((t) => {
          const done = hydrated && isTopicDone(s, t.stage, t.topic);
          return (
            <div key={`${t.stage}-${t.topic}`} className={`topic${done ? " done" : ""}`}>
              <button className={`qcheck${done ? " on" : ""}`} role="checkbox" aria-checked={done} aria-label="toggle done" onClick={() => toggleTopic(t.stage, t.topic)}>
                <span className="qb">[</span>
                <span className="qx">{done ? "x" : ""}</span>
                <span className="qb">]</span>
              </button>
              <div className="topic-main">
                <Link className="topic-label topic-gist" href={`/gist/${t.stage}/${t.topic}`} title="Read the gist">
                  {t.label}
                  {t.gists?.modes?.length ? <BookOpen size={13} className="topic-gist-ico" /> : null}
                </Link>
                {t.build ? (
                  <div className="res-row"><span className="res build"><Hammer size={13} className="res-ico" />build it</span></div>
                ) : t.res.length > 0 ? (
                  <div className="res-row">
                    {t.res.map((r) => <ResLink key={r.url + r.label} res={r} />)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {wk.campFinalWeek && wk.hasQuiz && (
        <div className={`clpr ${cleared ? "cleared" : complete ? "open" : "locked"}`}>
          <div className="clpr-info">
            <div className="kicker">clpr quiz</div>
            <div className="ct">{cleared ? `${wk.campAlt} summited` : `summit ${wk.campAlt}`}</div>
            <div className="cs">{clprStatus}</div>
          </div>
          {cleared ? (
            <ArrowLink href={`/quiz?stage=${wk.campId}`}>retake</ArrowLink>
          ) : complete ? (
            <ArrowLink href={`/quiz?stage=${wk.campId}`}>attempt</ArrowLink>
          ) : (
            <span className="clpr-locked-tag" title="locked" aria-label="locked"><Lock size={12} /></span>
          )}
        </div>
      )}

      <WeekComments weekKey={weekKey(track.id, wk.index)} />
      </>
      )}
    </div>
  );
}
