"use client";

import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { completedTopics, altitude } from "@/lib/store";
import { useGarageState } from "@/lib/garageView";
import { useContent } from "@/lib/content";

const WEEKS = 18;
const S = 14;      // cell footprint
const PITCH = 18;  // cell + gap
const BASE_RX = 58;
const BASE_RZ = -42;
const PLATE = 8;   // base plate thickness

const iso = (d: Date) => d.toISOString().slice(0, 10);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const BINS = [
  { top: "#35492f", side: "#202b1c", label: "under 30m" },
  { top: "#4f7f4a", side: "#2f4c2c", label: "30 to 60m" },
  { top: "#74c77f", side: "#47804d", label: "1 to 2h" },
  { top: "#abff84", side: "#6bb257", label: "over 2h" },
];

function bin(mins: number) {
  if (mins < 30) return 0;
  if (mins < 60) return 1;
  if (mins < 120) return 2;
  return 3;
}
const heightFor = (mins: number) => Math.min(110, Math.max(7, mins * 0.5));

type Active = { w: number; d: number; mins: number; date: string; today: boolean };

function Bar({ w, d, mins, today, onHover }: Active & { onHover: (a: Active | null) => void }) {
  const h = heightFor(mins);
  const c = BINS[bin(mins)];
  const left = w * PITCH;
  const top = d * PITCH;
  const face = (style: CSSProperties) => <div style={{ position: "absolute", left: 0, top: 0, ...style }} />;
  return (
    <div
      style={{ position: "absolute", left, top, width: S, height: S, transformStyle: "preserve-3d" }}
      onPointerEnter={() => onHover({ w, d, mins, date: "", today } as Active)}
      onPointerLeave={() => onHover(null)}
    >
      {face({ width: S, height: h, background: c.side, transform: `rotateX(-90deg)`, transformOrigin: "0 0" })}
      {face({ width: S, height: h, background: c.side, transform: `translateY(${S}px) rotateX(-90deg)`, transformOrigin: "0 0" })}
      {face({ width: h, height: S, background: c.side, transform: `rotateY(-90deg)`, transformOrigin: "0 0", filter: "brightness(0.82)" })}
      {face({ width: h, height: S, background: c.side, transform: `translateX(${S}px) rotateY(-90deg)`, transformOrigin: "0 0", filter: "brightness(0.82)" })}
      {face({ width: S, height: S, background: c.top, transform: `translateZ(${h}px)`, boxShadow: today ? "inset 0 0 0 1.5px #eafff0" : undefined })}
    </div>
  );
}

export function Board3D() {
  const { s, hydrated } = useGarageState();
  const { totalTopics } = useContent();
  const rx = useMotionValue(BASE_RX);
  const rz = useMotionValue(BASE_RZ);
  const transform = useMotionTemplate`rotateX(${rx}deg) rotateZ(${rz}deg)`;
  const drag = useRef<{ x: number; y: number; rx: number; rz: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [hover, setHover] = useState<Active | null>(null);

  const { active, totalMins, activeDays, peak, todayCell } = useMemo(() => {
    if (!hydrated) return { active: [] as Active[], totalMins: 0, activeDays: 0, peak: 0, todayCell: null as { w: number; d: number; logged: boolean } | null };
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const todayKey = iso(now);
    const end = new Date(now); end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end); start.setDate(start.getDate() - (WEEKS * 7 - 1));
    const out: Active[] = [];
    let tot = 0, days = 0, pk = 0;
    let w = 0, d = 0;
    let tCell: { w: number; d: number; logged: boolean } | null = null;
    for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const key = iso(cur);
      const isToday = key === todayKey;
      const e = s.entries[key];
      const m = e ? parseInt(e.mins, 10) || 0 : 0;
      if (m > 0) { out.push({ w, d, mins: m, date: key, today: isToday }); tot += m; days++; pk = Math.max(pk, m); }
      if (isToday) tCell = { w, d, logged: m > 0 };
      d++; if (d === 7) { d = 0; w++; }
    }
    return { active: out, totalMins: tot, activeDays: days, peak: pk, todayCell: tCell };
  }, [s.entries, hydrated]);

  const ground = useMemo(() => {
    const tiles: { w: number; d: number }[] = [];
    for (let w = 0; w < WEEKS; w++) for (let d = 0; d < 7; d++) tiles.push({ w, d });
    return tiles;
  }, []);

  const plateW = WEEKS * PITCH - (PITCH - S);
  const plateH = 7 * PITCH - (PITCH - S);

  function onPointerDown(e: PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, rx: rx.get(), rz: rz.get() };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setGrabbing(true);
    setHover(null);
  }
  function onPointerMove(e: PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    rz.set(drag.current.rz + dx * 0.45);
    rx.set(clamp(drag.current.rx - dy * 0.45, 6, 90));
  }
  function endDrag(e: PointerEvent) {
    if (!drag.current) return;
    drag.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    setGrabbing(false);
  }

  const onHover = (a: Active | null) => { if (!grabbing) setHover(a); };
  const hoverDate = hover ? active.find((x) => x.w === hover.w && x.d === hover.d) : null;
  const hoverLabel = hoverDate
    ? new Date(hoverDate.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : null;

  const hours = totalMins / 60;
  const modules = hydrated ? completedTopics(s) : 0;
  const alt = Math.round((hydrated ? altitude(s) : 0) * 100);

  return (
    <div className="board3d-wrap">
      <div
        className="board3d"
        style={{ height: 340, cursor: grabbing ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <motion.div className="board3d-stage" style={{ width: WEEKS * PITCH, height: 7 * PITCH, transform }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: plateW, height: plateH, transformStyle: "preserve-3d" }}>
            <div style={{ position: "absolute", inset: 0, background: "#0e0e0e", transform: `translateZ(-1px)` }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: plateW, height: PLATE, background: "#080808", transform: `rotateX(-90deg)`, transformOrigin: "0 0" }} />
            <div style={{ position: "absolute", left: 0, top: plateH, width: plateW, height: PLATE, background: "#050505", transform: `rotateX(-90deg)`, transformOrigin: "0 0" }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: PLATE, height: plateH, background: "#0a0a0a", transform: `rotateY(90deg)`, transformOrigin: "0 0" }} />
            <div style={{ position: "absolute", left: plateW, top: 0, width: PLATE, height: plateH, background: "#050505", transform: `rotateY(90deg)`, transformOrigin: "0 0" }} />
          </div>
          {ground.map((g) => (
            <div key={`g${g.w}-${g.d}`} className="b-ground" style={{ left: g.w * PITCH, top: g.d * PITCH, width: S, height: S }} />
          ))}
          {todayCell && !todayCell.logged && (
            <div className="b-today" style={{ left: todayCell.w * PITCH, top: todayCell.d * PITCH, width: S, height: S }} />
          )}
          {active.map((a) => <Bar key={`b${a.w}-${a.d}`} {...a} onHover={onHover} />)}
        </motion.div>
      </div>

      <div className="board-readout">
        {hoverLabel && (
          <span className="board-tip"><b className="sev-ok tnum">{hoverDate!.mins}m</b> <span className="sev-dim">on {hoverLabel}{hoverDate!.today ? " (today)" : ""}</span></span>
        )}
        <span><b className="sev-ok tnum">{hydrated ? hours.toFixed(1) : "0.0"}</b> <span className="sev-dim">hours</span></span>
        <span><b className="sev-info tnum">{hydrated ? activeDays : 0}</b> <span className="sev-dim">active days</span></span>
        <span><b className="sev-info tnum">{modules}</b><span className="sev-dim"> / {totalTopics} modules</span></span>
        <span><b className={alt >= 75 ? "sev-ok tnum" : "sev-info tnum"}>{alt}</b><span className="sev-dim">% altitude</span></span>
      </div>

      {hydrated && activeDays === 0 && (
        <div className="board-empty">no sessions logged yet . the board fills in as you check in below</div>
      )}

      <div className="board-legend">
        {BINS.map((b) => (
          <span key={b.label}><i style={{ background: b.top }} /> {b.label}</span>
        ))}
      </div>
    </div>
  );
}
