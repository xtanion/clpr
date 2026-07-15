"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SignInPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<{ google: boolean; github: boolean } | null>(null);

  useEffect(() => {
    if (user) window.location.href = "/";
  }, [user]);

  useEffect(() => {
    auth.providers().then(setProviders).catch(() => setProviders({ google: true, github: true }));
  }, []);

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "72px 0" }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>clpr</p>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--loud)", margin: "0 0 6px" }}>Sign in</h1>
      <p className="lead" style={{ marginBottom: 28 }}>
        Pick a track, climb the stages, clear the clpr. Your progress is saved to your account.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(!providers || providers.google) && <ProviderButton provider="google" label="Continue with Google" />}
        {(!providers || providers.github) && <ProviderButton provider="github" label="Continue with GitHub" />}
      </div>

      {providers && !providers.google && !providers.github && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px", color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
          No sign-in providers are configured on the server. Set{" "}
          <code style={{ color: "var(--text)" }}>GITHUB_CLIENT_ID</code>/<code style={{ color: "var(--text)" }}>SECRET</code>{" "}
          or the Google equivalents and restart the backend. See{" "}
          <code style={{ color: "var(--text)" }}>server/.env.example</code>.
        </div>
      )}

      <p className="mono-xs" style={{ marginTop: 24 }}>
        We only read your name, email, and avatar.
      </p>
    </div>
  );
}

function ProviderButton({ provider, label }: { provider: "google" | "github"; label: string }) {
  return (
    <a
      href={auth.loginUrl(provider)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "12px 16px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        color: "var(--text)",
        fontSize: 14,
        textDecoration: "none",
        transition: "border-color 120ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--focus)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
    >
      {label}
    </a>
  );
}
