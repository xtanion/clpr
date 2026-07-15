"use client";

import { useClpr, useHydrated, totalXp, engineerTitle } from "@/lib/store";

export function Stats() {
  const s = useClpr();
  const hydrated = useHydrated();
  const title = engineerTitle(s);
  const xp = totalXp(s);

  const tiles = [
    { k: "xp", v: xp.toLocaleString(), sev: xp > 0 ? "sev-ok" : "sev-dim", small: false },
    { k: "title", v: title, sev: title === "Apprentice" ? "sev-dim" : "sev-ok", small: true },
  ];

  return (
    <div className="stats">
      {tiles.map((t) => (
        <div key={t.k} className="stat">
          <span className="k">{t.k}</span>
          <span className={`v tnum ${hydrated ? t.sev : "sev-dim"}${t.small ? " v-sm" : ""}`}>{t.v}</span>
        </div>
      ))}
    </div>
  );
}
