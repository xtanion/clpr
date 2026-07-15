"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// The garage now lives at /garage/<username>. This bare route just forwards to the
// signed-in user's own garage (AuthGate guarantees a user before we get here).
export default function GarageIndexPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.username) router.replace(`/garage/${encodeURIComponent(user.username)}`);
  }, [user, router]);

  return (
    <section style={{ paddingTop: 48 }}>
      <div className="wrap" style={{ color: "var(--muted)", fontSize: 13 }}>opening your garage…</div>
    </section>
  );
}
