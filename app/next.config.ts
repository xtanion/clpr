import type { NextConfig } from "next";

// Same-origin auth: the browser only ever calls the Next origin, and these rewrites
// proxy /api/* (including the OAuth login/callback routes) to the FastAPI backend.
// This keeps the session cookie first-party. Server-side content fetches talk to the
// backend directly (see lib/serverContent.ts), so they are not affected.
const BACKEND = process.env.INTERNAL_API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};

export default nextConfig;
