import type { Content } from "./content";

// Server-side fetch of the content payload (runs in the RSC layout). Uses a
// server-only base URL so it can point at an internal address in deploys.
export async function loadContent(): Promise<Content> {
  const base =
    process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const res = await fetch(`${base}/api/content`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/content -> ${res.status}`);
  return res.json() as Promise<Content>;
}
