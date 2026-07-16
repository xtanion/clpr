"use client";

// Catches errors thrown while rendering the root layout — most likely loadContent()
// failing because the backend is unreachable. Without this boundary a failed SSR
// render 500s and Next hard-reloads, which can loop. global-error replaces the root
// layout, so it must render its own <html>/<body>.
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#e5e5e5" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "96px 24px", lineHeight: 1.6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Can’t reach the server</h2>
          <p style={{ fontSize: 14, color: "#9a9a9a", margin: "0 0 20px" }}>
            The app couldn’t load its content. The backend may be starting up or briefly
            unavailable — try again in a moment.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{ padding: "10px 16px", fontSize: 14, borderRadius: 8, border: "1px solid #333", background: "#161616", color: "#e5e5e5", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
