"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { useClpr, useHydrated, totalXp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Smartphone } from "@/components/ui/icons";

export function GlassNav() {
  const state = useClpr();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const xp = hydrated ? totalXp(state) : 0;

  if (!user) return null;

  // The garage is a per-user route (/garage/<username>); keep the tab highlighted
  // for any /garage/* path (your own or someone else's).
  const garageHref = user.username ? `/garage/${encodeURIComponent(user.username)}` : "/garage";
  // Every route resolves to exactly one tab so there is always a visible "you are
  // here". The learning surfaces reached from blueprints (climb, its quizzes, the
  // gist reader) all light up the climb tab.
  const links: { href: string; label: string; sep?: boolean; match: (p: string) => boolean }[] = [
    { href: "/", label: "blueprints", match: (p) => p === "/" },
    { href: "/climb", label: "climb", match: (p) => p.startsWith("/climb") || p.startsWith("/quiz") || p.startsWith("/gist") },
    { href: garageHref, label: "garage", match: (p) => p.startsWith("/garage") },
    { href: "/dashboard", label: "dashboard", match: (p) => p.startsWith("/dashboard") },
    { href: "/notes", label: "notes", match: (p) => p.startsWith("/notes") },
    { href: "/leaderboard", label: "board", sep: true, match: (p) => p.startsWith("/leaderboard") },
  ];

  return (
    <div className="gnav">
      <nav className="gnav-pill">
        <div className={`gnav-links${open ? " open" : ""}`}>
          {links.map((l) => (
            <Fragment key={l.href}>
              {l.sep && <span className="gnav-sep" aria-hidden="true" />}
              <Link
                href={l.href}
                aria-current={l.match(pathname) ? "page" : undefined}
                className={`gnav-link${l.match(pathname) ? " active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </Fragment>
          ))}
          {user.provider !== "dev" && (
            <button
              className="gnav-link gnav-signout-mobile"
              onClick={() => { setOpen(false); signOut(); }}
              title={user.email}
            >
              sign out
            </button>
          )}
        </div>
        <div className="gnav-right">
          <span className="gnav-xp tnum"><b>{xp.toLocaleString()}</b> xp</span>
          <button
            className="gnav-preview"
            onClick={() => window.open(window.location.href, "_blank", "popup=yes,width=390,height=844,noopener,noreferrer")}
            title="Open this page in a mobile-sized window"
            aria-label="Open this page in a mobile-sized window"
          >
            <Smartphone size={15} />
          </button>
          {user.provider !== "dev" && (
            <button className="gnav-link gnav-signout-desktop" onClick={() => signOut()} title={user.email}>sign out</button>
          )}
          <button className="gnav-toggle" aria-label="Menu" onClick={() => setOpen((o) => !o)}>menu</button>
        </div>
      </nav>
    </div>
  );
}
