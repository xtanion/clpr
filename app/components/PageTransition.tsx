"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

// Tab order (left to right), matching the nav bar: blueprints, garage, notes, board,
// with each tab's detail routes slotted beside it. Navigating to a route further
// right slides the new content in from the right; further left, from the left.
// Matched by prefix so dynamic routes like /garage/<username> resolve to their tab.
// Unlisted routes are treated as rightmost so deep links slide in from the right.
const ORDER = ["/", "/climb", "/garage", "/dashboard", "/notes", "/quiz", "/leaderboard"];
const orderOf = (path: string) => {
  let best = -1;
  let bestLen = -1;
  for (let i = 0; i < ORDER.length; i++) {
    const r = ORDER[i];
    const match = r === "/" ? path === "/" : path === r || path.startsWith(r + "/");
    if (match && r.length > bestLen) {
      best = i;
      bestLen = r.length;
    }
  }
  return best === -1 ? ORDER.length : best;
};

const DISTANCE = 64;

// Enter-only: the new page slides in from the correct side and settles. The old
// page is unmounted instantly (no exit phase), which keeps the motion a single,
// crisp left/right slide instead of a two-step out-then-in shuffle. Keying the
// element on pathname remounts it on each navigation so it replays.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const prev = useRef(pathname);

  const dir = orderOf(pathname) >= orderOf(prev.current) ? 1 : -1;
  useEffect(() => {
    prev.current = pathname;
  }, [pathname]);

  return (
    <div style={{ overflowX: "clip" }}>
      <motion.div
        key={pathname}
        initial={reduce ? false : { x: dir * DISTANCE, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
