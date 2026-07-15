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
  const links: { href: string; label: string; sep?: boolean; prefix?: string }[] = [
    { href: "/", label: "blueprints" },
    { href: garageHref, label: "garage", prefix: "/garage" },
    { href: "/notes", label: "notes" },
    { href: "/leaderboard", label: "board", sep: true },
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
                className={`gnav-link${(l.prefix ? pathname.startsWith(l.prefix) : pathname === l.href) ? " active" : ""}`}
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
