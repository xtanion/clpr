"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Status = "idle" | "working" | "done" | "error";

// Approval page for the clpr terminal client's device-authorization flow. The CLI
// opens this at /device?code=XXXX-XXXX; the signed-in user confirms the code, which
// binds their account to the pending device request so the CLI can exchange it for a
// personal token. AuthGate already bounces anonymous visitors to /signin.
export default function DevicePage() {
  return (
    <Suspense>
      <DeviceApproval />
    </Suspense>
  );
}

function DeviceApproval() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const c = params.get("code");
    if (c) setCode(c.toUpperCase());
  }, [params]);

  async function approve() {
    setStatus("working");
    setError("");
    try {
      await auth.approveDevice(code.trim().toUpperCase());
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof ApiError ? errorFor(e.status) : "Something went wrong.");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "72px 0" }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>authorize device</p>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--loud)", margin: "0 0 6px" }}>clpr CLI</h1>
      <p className="lead" style={{ marginBottom: 24 }}>
        Confirm the code shown in your terminal to link the <code>clpr</code> command to
        {user ? ` ${user.name || user.username}` : " your account"}.
      </p>

      {status === "done" ? (
        <div style={{ border: "1px solid var(--green)", padding: "16px 18px", color: "var(--text)", fontSize: 14, lineHeight: 1.6 }}>
          <span className="sev-ok">approved</span> — return to your terminal. The CLI will
          finish signing in automatically.
        </div>
      ) : (
        <>
          <label className="mono-xs" style={{ display: "block", marginBottom: 8 }}>device code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            spellCheck={false}
            autoFocus
            style={{
              width: "100%", padding: "12px 14px", border: "1px solid var(--line)",
              background: "transparent", color: "var(--text)", fontFamily: "inherit",
              fontSize: 18, letterSpacing: 2, textAlign: "center", marginBottom: 16,
            }}
          />
          <button
            className="btn"
            onClick={approve}
            disabled={!code.trim() || status === "working"}
            style={{ width: "100%", padding: "12px 16px", fontSize: 14 }}
          >
            {status === "working" ? "approving…" : "Approve"}
          </button>
          {status === "error" && (
            <p className="mono-xs sev-crit" style={{ marginTop: 12 }}>{error}</p>
          )}
        </>
      )}

      <p className="mono-xs" style={{ marginTop: 24 }}>
        Only approve a code you started yourself from the clpr terminal client.
      </p>
    </div>
  );
}

function errorFor(status: number): string {
  if (status === 404) return "Unknown code. Check the terminal and try again.";
  if (status === 409) return "This code was already used or handled.";
  if (status === 410) return "This code expired. Run `clpr login` again.";
  if (status === 401) return "Please sign in first.";
  return `Request failed (${status}).`;
}
