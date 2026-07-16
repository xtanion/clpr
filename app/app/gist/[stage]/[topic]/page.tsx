"use client";

import { useParams } from "next/navigation";
import { useContent } from "@/lib/content";
import { GistView } from "@/components/gist/GistView";

export default function GistPage() {
  const params = useParams<{ stage: string; topic: string }>();
  const stage = Number(params.stage);
  const topic = Number(params.topic);
  const { roadmap } = useContent();
  const label = roadmap[stage]?.topics[topic]?.label ?? "concept";
  return <GistView stage={stage} topic={topic} label={label} />;
}
