"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type GistDoc } from "@/lib/api";
import { getPack, putPack, packKey } from "./packs";

// The Offline Reader's data source. Cache-first for an instant paint, then a network
// refresh that also re-stores the pack; if the network is unavailable, the cached
// pack is what you read. So a concept that was smart-downloaded reads fine with the
// connection cut, and one that wasn't still loads normally when online.
export type GistSource = "cache" | "network" | null;

export type UseGist = {
  doc: GistDoc | null;
  source: GistSource;
  error: "notfound" | "error" | null;
  loading: boolean;
  offline: boolean;
};

type Internal = UseGist & { key: string };

const loadingFor = (key: string): Internal => ({
  key,
  doc: null,
  source: null,
  error: null,
  loading: true,
  offline: false,
});

export function useGist(stage: number, topic: number, label: string): UseGist {
  const key = packKey(stage, topic);
  const [state, setState] = useState<Internal>({ ...loadingFor(""), key: "" });

  useEffect(() => {
    let alive = true;

    (async () => {
      const cached = await getPack(stage, topic);
      if (!alive) return;
      // Paint the cached copy immediately; keep the spinner only while we still
      // expect a network refresh to land.
      if (cached) {
        setState({
          key,
          doc: cached.doc,
          source: "cache",
          error: null,
          loading: navigator.onLine,
          offline: !navigator.onLine,
        });
      }

      try {
        const doc = await api.getGists(stage, topic);
        if (!alive) return;
        setState({ key, doc, source: "network", error: null, loading: false, offline: false });
        putPack(stage, topic, label, doc);
      } catch (e) {
        if (!alive) return;
        if (cached) {
          // Network failed but we have the pack — that's the offline read path.
          setState((s) => ({ ...s, key, loading: false, offline: true }));
          return;
        }
        if (e instanceof ApiError && e.status === 404) {
          setState({ key, doc: null, source: null, error: "notfound", loading: false, offline: false });
        } else {
          setState({ key, doc: null, source: null, error: "error", loading: false, offline: !navigator.onLine });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [key, stage, topic, label]);

  // Until this render's concept has produced state, present a clean loading view so a
  // previous concept's content never flashes when switching topics.
  const current = state.key === key ? state : loadingFor(key);
  return current;
}
