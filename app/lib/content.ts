"use client";

import { createContext, useContext } from "react";
import type { Stage, Quiz, TreeNode, World, Genre, Friend, RaceRunner, Mat, Mats, Artifact } from "./data";

// The full content payload served by GET /api/content. Nothing here is hardcoded
// in the client anymore; it all comes from the backend.
export type Content = {
  roadmap: Stage[];
  totalTopics: number;
  quizzes: Quiz[];
  tree: TreeNode;
  worlds: World[];
  genres: Genre[];
  friends: Friend[];
  globalUsers: Friend[];
  races: Record<string, RaceRunner[]>;
  materials: { id: Mat; name: string }[];
  campMaterials: Mats[];
  artifacts: Artifact[];
};

// Module-level handle so non-hook code (store selectors) can read content after the
// provider has injected it. Set once, on the first render of <Bootstrap>.
let _content: Content | null = null;
export function setContent(c: Content) { _content = c; }
export function getContent(): Content {
  if (!_content) throw new Error("content not loaded yet");
  return _content;
}

export const ContentContext = createContext<Content | null>(null);
export function useContent(): Content {
  const c = useContext(ContentContext);
  if (!c) throw new Error("useContent must be used within <Bootstrap>");
  return c;
}
