"use client";

// Client-side calls to the FastAPI backend. Requests go to the same origin and are
// proxied to the backend by the Next rewrite (next.config.ts), so the session cookie
// is sent automatically. Identity comes from that cookie, not a user id in the URL.
const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new ApiError(res.status, `${init?.method || "GET"} ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export type ResponseIn = { index: number; value: string; frac: number; pass: boolean; msg: string };
export type Profile = { id: string; email: string; name: string; username: string; avatarUrl: string; provider: string };
export type GistMode = { body: string; meta: Record<string, unknown>; version: string; updatedAt: string };
export type GistDoc = { stage: number; topic: number; version: string; modes: Record<string, GistMode> };

export const auth = {
  me: () => req<Profile>("/api/auth/me"),
  providers: () => req<{ google: boolean; github: boolean }>("/api/auth/providers"),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  loginUrl: (provider: "google" | "github") => `${BASE}/api/auth/${provider}/login`,
  approveDevice: (userCode: string) =>
    req<{ ok: boolean }>("/api/auth/device/approve", { method: "POST", body: JSON.stringify({ userCode }) }),
};

export const api = {
  getState: <T>() => req<T>("/api/state"),
  getLeaderboard: <T>() => req<T>("/api/leaderboard"),
  getPublicGarage: <T>(username: string) => req<T>(`/api/users/${encodeURIComponent(username)}`),
  getRaces: <T>() => req<T>("/api/races/live"),
  getGists: (stage: number, topic: number) => req<GistDoc>(`/api/concepts/${stage}/${topic}/gists`),
  saveEntry: <T>(body: { date: string; focus: number; conf: number; mins: string; summary: string; notes: string }) =>
    req<T>("/api/entries", { method: "POST", body: JSON.stringify(body) }),
  deleteEntry: <T>(date: string) => req<T>(`/api/entries/${date}`, { method: "DELETE" }),
  toggleProgress: <T>(body: { stage: number; topic: number; done?: boolean | null }) =>
    req<T>("/api/progress", { method: "PUT", body: JSON.stringify(body) }),
  setStartDate: <T>(startDate: string) =>
    req<T>("/api/start-date", { method: "PUT", body: JSON.stringify({ startDate }) }),
  addComment: <T>(body: { key: string; text: string; author: string }) =>
    req<T>("/api/comments", { method: "POST", body: JSON.stringify(body) }),
  buildArtifact: <T>(id: string) =>
    req<T>("/api/artifacts", { method: "POST", body: JSON.stringify({ id }) }),
  reset: <T>() => req<T>("/api/state/reset", { method: "POST" }),
  attempt: <T>(stage: number, body: { responses: ResponseIn[]; timeMs: number }) =>
    req<T>(`/api/quizzes/${stage}/attempt`, { method: "POST", body: JSON.stringify(body) }),
};
