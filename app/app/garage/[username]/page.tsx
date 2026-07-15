"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { Board3D } from "@/components/Board3D";
import { Greeting } from "@/components/dashboard/Greeting";
import { Objective } from "@/components/dashboard/Objective";
import { CheckInForm } from "@/components/dashboard/CheckInForm";
import { useAuth } from "@/lib/auth";
import { GarageViewProvider } from "@/lib/garageView";
import { api, ApiError, type Profile } from "@/lib/api";
import type { State } from "@/lib/store";

type PublicGarage = { profile: Profile; state: State };

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ paddingTop: 48 }}>
      <div className="wrap" style={{ color: "var(--muted)", fontSize: 13 }}>{children}</div>
    </section>
  );
}

// Your own garage: the live store drives everything, and the daily check-in is
// included. Mirrors the dashboard layout (the 3D board on top).
function OwnGarage() {
  return (
    <>
      <section style={{ paddingTop: 24, paddingBottom: 8 }}>
        <div className="wrap">
          <Reveal><Greeting /></Reveal>
          <Reveal><Board3D /></Reveal>
        </div>
      </section>
      <section style={{ paddingTop: 8 }}><div className="wrap"><Reveal><Objective /></Reveal></div></section>
      <section style={{ paddingTop: 24 }}><div className="wrap"><Reveal><CheckInForm /></Reveal></div></section>
    </>
  );
}

// Someone else's garage: fetch their sanitized state and render a read-only board
// (no check-in — that's self-only). Keyed by username in the parent so navigating
// to a different user remounts this fresh.
function VisitedGarage({ username }: { username: string }) {
  const [data, setData] = useState<PublicGarage | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "notfound" | "error">("loading");

  useEffect(() => {
    let alive = true;
    api
      .getPublicGarage<PublicGarage>(username)
      .then((d) => { if (alive) { setData(d); setStatus("loaded"); } })
      .catch((e) => {
        if (alive) setStatus(e instanceof ApiError && e.status === 404 ? "notfound" : "error");
      });
    return () => { alive = false; };
  }, [username]);

  if (status === "notfound") return <Notice>No garage found for <b>{username}</b>.</Notice>;
  if (status === "error") return <Notice>Couldn’t load this garage. Try again.</Notice>;
  if (!data) return <Notice>opening garage…</Notice>;

  const name = data.profile.username || data.profile.name;
  return (
    <GarageViewProvider value={{ state: data.state, hydrated: true, readOnly: true }}>
      <section style={{ paddingTop: 24, paddingBottom: 8 }}>
        <div className="wrap">
          <Reveal><p className="eyebrow" style={{ marginBottom: 16 }}>{name}’s garage</p></Reveal>
          <Reveal><Board3D /></Reveal>
        </div>
      </section>
      <section style={{ paddingTop: 8 }}><div className="wrap"><Reveal><Objective /></Reveal></div></section>
    </GarageViewProvider>
  );
}

export default function GarageUserPage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { user } = useAuth(); // AuthGate guarantees a signed-in user here

  if (user && user.username === username) return <OwnGarage />;
  return <VisitedGarage key={username} username={username} />;
}
