import { getContent } from "./content";
import type { Stage, Resource, GistAvail } from "./data";

// Clean data contract for a learning track, built from the backend-served content
// (roadmap + quizzes) rather than any hardcoded data.

export type WeekTopic = { stage: number; topic: number; label: string; res: Resource[]; build?: boolean; gists?: GistAvail };
export type Week = {
  index: number;
  weekNo: number;
  campId: number;
  campAlt: string;
  campTitle: string;
  topics: WeekTopic[];
  campFinalWeek: boolean;
  hasQuiz: boolean;
};
export type Track = { id: string; name: string; camps: Stage[]; weeks: Week[] };

const NAMES: Record<string, string> = { "llm-inference": "llm" };

export function getTrack(topicId: string): Track {
  const { roadmap, quizzes } = getContent();
  const camps = roadmap;
  const weeks: Week[] = [];
  for (let w = 0; w < camps.length * 2; w++) {
    const campId = Math.floor(w / 2);
    const half = w % 2;
    const camp = camps[campId];
    const idx = [half * 2, half * 2 + 1];
    const topics: WeekTopic[] = idx.map((t) => ({
      stage: campId,
      topic: t,
      label: camp.topics[t].label,
      res: camp.topics[t].res,
      build: camp.topics[t].build,
      gists: camp.topics[t].gists,
    }));
    weeks.push({
      index: w,
      weekNo: w + 1,
      campId,
      campAlt: camp.alt,
      campTitle: camp.title,
      topics,
      campFinalWeek: half === 1,
      hasQuiz: quizzes.some((q) => q.stage === campId),
    });
  }
  return { id: topicId, name: NAMES[topicId] ?? topicId, camps, weeks };
}

export function weekKey(trackId: string, weekIndex: number) {
  return `${trackId}:w${weekIndex}`;
}
