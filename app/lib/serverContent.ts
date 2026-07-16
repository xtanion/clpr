import type { Content } from "./content";

// Server-side fetch of the content payload (runs in the RSC layout). Uses a
// server-only base URL so it can point at an internal address in deploys.
export async function loadContent(): Promise<Content> {
  const base =
    process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  // Retry a few times so a brief backend outage — a dev `uvicorn --reload` restart,
  // or a cold Render instance — doesn't 500 the whole layout and send the app into a
  // reload loop. Only the failure path waits; a healthy backend returns on attempt 1.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${base}/api/content`, { cache: "no-store" });
      if (!res.ok) throw new Error(`GET /api/content -> ${res.status}`);
      return (await res.json()) as Content;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}
