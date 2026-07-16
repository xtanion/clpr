import { NextResponse, type NextRequest } from "next/server";

// Inject the backend shared secret into every /api/* request server-side, so the
// key stays on the server and the browser never sees it. The next.config rewrite
// then forwards the (augmented) request to the backend. No-op if the key isn't set.
export function proxy(request: NextRequest) {
  const key = process.env.BACKEND_API_KEY;
  if (!key) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.set("x-api-key", key);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
