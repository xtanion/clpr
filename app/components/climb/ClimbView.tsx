"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTrack } from "@/lib/track";
import { useClpr, useHydrated, isTopicDone, completedTopics, highestStageCleared } from "@/lib/store";
import { useContent } from "@/lib/content";
import { WeekView } from "./WeekView";

export function ClimbView() {
  const params = useSearchParams();
  const topic = params.get("topic") || "llm-inference";
  const track = useMemo(() => getTrack(topic), [topic]);
  const s = useClpr();
  const hydrated = useHydrated();
  const { totalTopics: TOTAL_TOPICS } = useContent();

  const campParam = params.get("camp");
  const [week, setWeek] = useState(0);
  const inited = useRef(false);
  const last = track.weeks.length - 1;

  useEffect(() => {
    if (!hydrated || inited.current) return;
    inited.current = true;
    if (campParam !== null) {
      const c = parseInt(campParam, 10);
      if (!isNaN(c)) { setWeek(Math.min(Math.max(c * 2, 0), last)); return; }
    }
    const first = track.weeks.find((wk) => !wk.topics.every((t) => isTopicDone(s, t.stage, t.topic)));
    setWeek(first ? first.index : last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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
        <button className="pager-btn" disabled={week === 0} aria-label="Previous week" onClick={() => setWeek((w) => Math.max(0, w - 1))}>{"<"}</button>
        <button className="pager-btn" disabled={week === last} aria-label="Next week" onClick={() => setWeek((w) => Math.min(last, w + 1))}>{">"}</button>
      </div>
    </>
  );
}
