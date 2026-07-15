"use client";

import { useAuth } from "@/lib/auth";

// Personalized garage header: greets the signed-in user by their username,
// falling back to the plain section label before auth resolves / when signed out.
export function Greeting() {
  const { user } = useAuth();
  const name = user?.username || user?.name?.trim();
  return (
    <p className="eyebrow" style={{ marginBottom: 16 }}>
      {name ? `welcome back, ${name}` : "garage"}
    </p>
  );
}
