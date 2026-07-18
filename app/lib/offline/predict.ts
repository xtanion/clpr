import type { Content } from "@/lib/content";
import { isTopicDone, type State } from "@/lib/store";
import { packKey } from "./packs";

// What the learner is most likely to read next. The roadmap is an ordered syllabus
// (stage, then topic), and the app is a linear climb — so "next" is simply the
// concepts from the learner's current position forward. We start at the first
// incomplete topic (what they're on now) and walk forward, collecting concepts that
// actually have gists generated. This is the prediction behind smart downloads: pull
// KV Cache / FlashAttention / PagedAttention before the learner reaches them.
export type PredictedConcept = {
  stage: number;
  topic: number;
  label: string;
  version: string;
  key: string;
};

export function predictNext(content: Content, s: State, window = 6): PredictedConcept[] {
  const out: PredictedConcept[] = [];
  const { roadmap } = content;
  let started = false;
  for (let st = 0; st < roadmap.length; st++) {
    const topics = roadmap[st].topics;
    for (let t = 0; t < topics.length; t++) {
      // Skip everything the learner has already cleared until we hit the cursor
      // (their first incomplete topic). From there on, everything is "upcoming".
      if (!started) {
        if (isTopicDone(s, st, t)) continue;
        started = true;
      }
      const g = topics[t].gists;
      if (g?.modes?.length) {
        out.push({ stage: st, topic: t, label: topics[t].label, version: g.version || "", key: packKey(st, t) });
        if (out.length >= window) return out;
      }
    }
  }
  return out;
}
