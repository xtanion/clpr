"use client";

import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTrack } from "@/lib/track";
import { useClpr, useHydrated, isTopicDone, completedTopics, highestStageCleared } from "@/lib/store";
import { useContent } from "@/lib/content";
import { WeekView } from "./WeekView";

export function ClimbView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const topic = params.get("topic") || "llm-inference";
  const track = useMemo(() => getTrack(topic), [topic]);
  const s = useClpr();
  const hydrated = useHydrated();
  const { totalTopics: TOTAL_TOPICS } = useContent();

  const campParam = params.get("camp");
  const weekParam = params.get("week");
  const [week, setWeek] = useState(0);
  const inited = useRef(false);
  const last = track.weeks.length - 1;
  const clamp = (w: number) => Math.min(Math.max(w, 0), last);

  const weekKeyStore = `clpr:week:${topic}`;

  useEffect(() => {
    if (!hydrated || inited.current) return;
    inited.current = true;
    // Restore the week you were on, so returning (e.g. browser back after opening a
    // gist) lands on the same page. Priority: explicit ?week, then the last-viewed
    // week for this topic (sessionStorage — survives navigation regardless of history
    // quirks), then ?camp, then the first incomplete week.
    if (weekParam !== null) {
      const w = parseInt(weekParam, 10);
      if (!isNaN(w)) { setWeek(clamp(w)); return; }
    }
    try {
      const saved = sessionStorage.getItem(weekKeyStore);
      if (saved !== null) {
        const w = parseInt(saved, 10);
        if (!isNaN(w)) { setWeek(clamp(w)); return; }
      }
    } catch { /* sessionStorage unavailable */ }
    if (campParam !== null) {
      const c = parseInt(campParam, 10);
      if (!isNaN(c)) { setWeek(clamp(c * 2)); return; }
    }
    const first = track.weeks.find((wk) => !wk.topics.every((t) => isTopicDone(s, t.stage, t.topic)));
    setWeek(first ? first.index : last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Persist the week to sessionStorage (reliable restore) and the URL (shareable).
  function goWeek(w: number) {
    const next = clamp(w);
    setWeek(next);
    try { sessionStorage.setItem(weekKeyStore, String(next)); } catch { /* ignore */ }
    const q = new URLSearchParams(params.toString());
    q.set("week", String(next));
    q.delete("camp");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  const topicsDone = hydrated ? completedTopics(s) : 0;
  const summited = hydrated ? highestStageCleared(s) : 0;

  return (
    <>
      <div className="climb-top">
        <p className="eyebrow">
          <Link href="/" className="crumb">compsci / ai</Link> / {track.name}
        </p>
        <span className="climb-prog tnum sev-dim">
          <span className="sev-info">{topicsDone}</span>/{TOTAL_TOPICS} topics · <span className="sev-ok">{summited}</span>/{track.camps.length} summited
        </span>
      </div>

      <WeekView track={track} weekIndex={week} />

      <div className="week-pager">
        <span className="week-pos tnum">{week + 1} / {track.weeks.length}</span>
        <button className="pager-btn" disabled={week === 0} aria-label="Previous week" onClick={() => goWeek(week - 1)}>{"<"}</button>
        <button className="pager-btn" disabled={week === last} aria-label="Next week" onClick={() => goWeek(week + 1)}>{">"}</button>
      </div>
    </>
  );
}
