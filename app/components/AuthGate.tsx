"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

const PUBLIC_PATHS = ["/signin"];

// Client-side gate: everything except the public paths requires a signed-in user.
// Unauthenticated visitors are redirected to /signin. Content endpoints stay public,
// but the app shell is gated so per-user state never loads for an anonymous visitor.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublic) router.replace("/signin");
  }, [loading, user, isPublic, router]);

  if (isPublic) return <>{children}</>;

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "var(--muted)", fontSize: 13 }}>
        {loading ? "authenticating…" : "redirecting to sign in…"}
      </div>
    );
  }

  return <>{children}</>;
}
