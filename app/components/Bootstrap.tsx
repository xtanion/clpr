"use client";

import type { ReactNode } from "react";
import { ContentContext, setContent, type Content } from "@/lib/content";

// Receives the server-fetched content and makes it available two ways: via context
// (useContent) for components, and via the module handle (getContent) for store
// selectors. setContent runs during render so it is set before children render.
export function Bootstrap({ content, children }: { content: Content; children: ReactNode }) {
  setContent(content);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}
