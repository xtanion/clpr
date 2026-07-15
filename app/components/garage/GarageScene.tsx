"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useReducedMotion } from "motion/react";
import { useClpr, useHydrated, highestStageCleared, nextObjective, todayIso } from "@/lib/store";
import { useContent } from "@/lib/content";

const HM = ["#161616", "#2c3a2e", "#3f6a45", "#63b96f", "#abff84"];
const METAL = "#26262b";
const DARK = "#1a1a1d";
const GREEN = "#abff84";
const iso = (d: Date) => d.toISOString().slice(0, 10);
function level(mins: string) {
  const m = parseInt(mins, 10);
  if (isNaN(m) || m <= 0) return 0;
  if (m < 30) return 1;
  if (m < 60) return 2;
  if (m < 120) return 3;
  return 4;
}
const MODELS = ["makemore", "nanoGPT 124M", "GPT-2 124M", "GPT-2 + Flash", "Llama 3 8B", "Llama 3 8B (vLLM)", "Llama 3 70B", "Mixtral 8x7B"];
const TOKS = [140, 95, 72, 130, 41, 320, 58, 190];

/* ---------- static room ---------- */
function Floor() {
  const n = 8, size = 6, t = size / n;
  const tiles = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const dark = (i + j) % 2 === 0;
    tiles.push(
      <mesh key={`${i}-${j}`} rotation={[-Math.PI / 2, 0, 0]} position={[-size / 2 + t / 2 + i * t, 0, -size / 2 + t / 2 + j * t]} receiveShadow>
        <planeGeometry args={[t, t]} />
        <meshStandardMaterial color={dark ? "#0c0c0d" : "#18181c"} roughness={0.9} />
      </mesh>,
    );
  }
  return <group>{tiles}</group>;
}

function Walls() {
  return (
    <group>
      <mesh position={[0, 1.8, -3]} receiveShadow><boxGeometry args={[6, 3.6, 0.15]} /><meshStandardMaterial color="#101012" roughness={1} /></mesh>
      <mesh position={[-3, 1.8, 0]} receiveShadow><boxGeometry args={[0.15, 3.6, 6]} /><meshStandardMaterial color="#0c0c0e" roughness={1} /></mesh>
    </group>
  );
}

function GarageDoor() {
  const slats = [];
  for (let y = 0.15; y < 3.1; y += 0.19) slats.push(
    <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[0.06, 0.15, 3.4]} /><meshStandardMaterial color="#2a2c33" metalness={0.45} roughness={0.5} /></mesh>,
  );
  return <group position={[-2.88, 0, 0.5]}>{slats}</group>;
}

function HeatPanel({ cells }: { cells: number[] }) {
  const cell = 0.055, gap = 0.02, pitch = cell + gap;
  const cols = Math.ceil(cells.length / 7);
  const w = cols * pitch, h = 7 * pitch;
  return (
    <group position={[-w / 2 - 0.6, 2.4, -2.9]}>
      <mesh position={[w / 2 - pitch / 2, -(h / 2 - pitch / 2), -0.02]}><boxGeometry args={[w + 0.08, h + 0.08, 0.04]} /><meshStandardMaterial color="#0a0d0a" roughness={0.7} /></mesh>
      {cells.map((lv, i) => {
        const col = Math.floor(i / 7), row = i % 7;
        return <mesh key={i} position={[col * pitch, -(row * pitch), 0.01]}><planeGeometry args={[cell, cell]} /><meshStandardMaterial color={HM[lv]} emissive={lv >= 3 ? HM[lv] : "#000"} emissiveIntensity={lv >= 3 ? 0.5 : 0} toneMapped={false} /></mesh>;
      })}
    </group>
  );
}

function Desk() {
  return (
    <group position={[-1.35, 0, -1.5]}>
      <mesh castShadow receiveShadow position={[0, 0.74, 0]}><boxGeometry args={[1.3, 0.06, 0.7]} /><meshStandardMaterial color={DARK} roughness={0.7} /></mesh>
      {[[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.37, z]}><boxGeometry args={[0.06, 0.74, 0.06]} /><meshStandardMaterial color="#141416" /></mesh>
      ))}
    </group>
  );
}

function Monitor({ animate }: { animate: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame((st) => { if (animate && mat.current) mat.current.emissiveIntensity = 0.38 + 0.12 * Math.sin(st.clock.elapsedTime * 2); });
  return (
    <group position={[-1.55, 0.77, -1.55]}>
      <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.06, 0.28, 0.06]} /><meshStandardMaterial color={METAL} /></mesh>
      <group position={[0, 0.42, 0]} rotation={[0, 0.7, 0]}>
        <mesh castShadow><boxGeometry args={[0.72, 0.46, 0.04]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
        <mesh position={[0, 0, 0.022]}><planeGeometry args={[0.64, 0.38]} /><meshStandardMaterial ref={mat} color="#0e1a0e" emissive={GREEN} emissiveIntensity={0.4} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

function Mug() {
  return (
    <group position={[-0.95, 0.77, -1.3]}>
      <mesh castShadow position={[0, 0.07, 0]}><cylinderGeometry args={[0.06, 0.055, 0.14, 14]} /><meshStandardMaterial color="#3a3a40" roughness={0.6} /></mesh>
      <mesh position={[0.08, 0.07, 0]}><torusGeometry args={[0.04, 0.012, 8, 14]} /><meshStandardMaterial color="#3a3a40" /></mesh>
    </group>
  );
}

function Whiteboard() {
  return (
    <group position={[1.4, 2.0, -2.87]}>
      <mesh castShadow><boxGeometry args={[1.3, 0.9, 0.06]} /><meshStandardMaterial color="#d8d8d0" roughness={0.5} /></mesh>
      <mesh position={[-0.25, 0.05, 0.035]}><planeGeometry args={[0.6, 0.04]} /><meshStandardMaterial color="#2a2a2a" /></mesh>
      <mesh position={[-0.15, -0.12, 0.035]}><planeGeometry args={[0.75, 0.04]} /><meshStandardMaterial color="#8a8a86" /></mesh>
    </group>
  );
}

function Blueprint() {
  return (
    <group position={[2.35, 2.25, -2.86]} rotation={[0, 0, 0.04]}>
      <mesh><planeGeometry args={[0.5, 0.66]} /><meshStandardMaterial color="#274a86" emissive="#12335f" emissiveIntensity={0.25} /></mesh>
      <mesh position={[0, 0, 0.31]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#d33" emissive="#d33" emissiveIntensity={0.4} toneMapped={false} /></mesh>
    </group>
  );
}

function BlinkLed({ position, phase, animate }: { position: [number, number, number]; phase: number; animate: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame((st) => { if (animate && mat.current) mat.current.emissiveIntensity = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 3 + phase)); });
  return <mesh position={position}><boxGeometry args={[0.05, 0.05, 0.02]} /><meshStandardMaterial ref={mat} color={GREEN} emissive={GREEN} emissiveIntensity={0.6} toneMapped={false} /></mesh>;
}

function Rack({ x, z, height, slats, animate }: { x: number; z: number; height: number; slats: number; animate: boolean }) {
  const ys = Array.from({ length: slats }, (_, i) => 0.3 + (i * (height - 0.4)) / Math.max(1, slats - 1));
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}><boxGeometry args={[0.7, height, 0.5]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      {ys.map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 0.26]}><boxGeometry args={[0.6, 0.11, 0.04]} /><meshStandardMaterial color="#0e0e10" /></mesh>
          <BlinkLed position={[0.22, y, 0.29]} phase={i * 1.7 + x} animate={animate} />
        </group>
      ))}
    </group>
  );
}

function Printer() {
  return (
    <group position={[-1.5, 0, 1.5]}>
      <mesh castShadow position={[0, 0.4, 0]}><boxGeometry args={[0.75, 0.8, 0.75]} /><meshStandardMaterial color={DARK} metalness={0.3} roughness={0.6} /></mesh>
      <mesh castShadow position={[0, 0.85, 0]}><boxGeometry args={[0.78, 0.08, 0.78]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 0.55, 0.38]}><boxGeometry args={[0.5, 0.28, 0.02]} /><meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.35} toneMapped={false} /></mesh>
    </group>
  );
}

function RobotArm({ animate }: { animate: boolean }) {
  const arm = useRef<THREE.Group>(null!);
  useFrame((st) => { if (animate && arm.current) arm.current.rotation.z = -0.5 + 0.35 * Math.sin(st.clock.elapsedTime * 1.4); });
  return (
    <group position={[0.2, 0, 1.9]}>
      <mesh castShadow position={[0, 0.12, 0]}><cylinderGeometry args={[0.3, 0.34, 0.24, 16]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      <mesh castShadow position={[0, 0.6, 0]}><boxGeometry args={[0.16, 0.8, 0.16]} /><meshStandardMaterial color="#2e2e34" metalness={0.5} roughness={0.5} /></mesh>
      <group ref={arm} position={[0, 1.0, 0]}>
        <mesh castShadow position={[0.32, 0, 0]}><boxGeometry args={[0.7, 0.13, 0.13]} /><meshStandardMaterial color="#2e2e34" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0.66, 0, 0]}><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.9} toneMapped={false} /></mesh>
      </group>
      <mesh castShadow position={[0.55, 0.1, 0]}><boxGeometry args={[0.14, 0.2, 0.14]} /><meshStandardMaterial color="#33332f" metalness={0.4} roughness={0.6} /></mesh>
    </group>
  );
}

function Oscilloscope() {
  return (
    <group position={[-1.9, 0, -0.2]}>
      <mesh castShadow position={[0, 0.55, 0]}><boxGeometry args={[0.5, 0.5, 0.9]} /><meshStandardMaterial color="#28282c" metalness={0.4} roughness={0.6} /></mesh>
      <mesh position={[0.26, 0.55, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.6, 0.34]} /><meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.5} toneMapped={false} /></mesh>
    </group>
  );
}

function ToolWall() {
  const pegs: [number, number][] = [[-0.4, 0.3], [-0.1, 0.35], [0.2, 0.28], [-0.35, -0.1], [0.1, -0.05], [0.35, -0.2]];
  return (
    <group position={[-2.87, 1.25, 1.1]} rotation={[0, Math.PI / 2, 0]}>
      <mesh><boxGeometry args={[1.3, 1.0, 0.05]} /><meshStandardMaterial color="#20242a" roughness={0.8} /></mesh>
      {pegs.map(([px, py], i) => <mesh key={i} position={[px, py, 0.06]}><boxGeometry args={[0.08, 0.26, 0.04]} /><meshStandardMaterial color="#3a3a40" metalness={0.5} roughness={0.5} /></mesh>)}
    </group>
  );
}

function GarageHud() {
  const s = useClpr();
  const hydrated = useHydrated();
  const cleared = hydrated ? highestStageCleared(s) : 0;
  const idx = Math.min(cleared, MODELS.length - 1);
  const base = TOKS[idx];
  const [toks, setToks] = useState(base);
  useEffect(() => {
    setToks(base);
    const id = setInterval(() => setToks(base + Math.round((Math.random() - 0.5) * Math.max(4, base * 0.12))), 850);
    return () => clearInterval(id);
  }, [base]);
  const obj = hydrated ? nextObjective(s) : null;
  const today = hydrated && !!s.entries[todayIso()];
  return (
    <div className="ghud">
      <div className="ghud-row"><span className="ghud-k">// now studying</span><span className="sev-ok">{MODELS[idx]}</span><span className="ghud-dim tnum">{toks} tok/s</span></div>
      {obj && obj.kind !== "done" && <div className="ghud-row"><span className="ghud-k">// goal</span><span className="ghud-goal">{obj.label}</span></div>}
      <div className="ghud-row"><span className="ghud-k">// today</span><span className={today ? "sev-ok" : "ghud-dim"}>{today ? "session logged" : "not logged yet"}</span></div>
    </div>
  );
}

export default function GarageScene() {
  const s = useClpr();
  const hydrated = useHydrated();
  const { artifacts } = useContent();
  const reduce = useReducedMotion();
  const animate = !reduce;
  const cleared = hydrated ? highestStageCleared(s) : 0;
  const reqOf = (id: string) => artifacts.find((a) => a.id === id)?.req ?? 99;
  const has = (id: string) => cleared >= reqOf(id);
  const today = hydrated && !!s.entries[todayIso()];

  const cells = useMemo(() => {
    const weeks = 18;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const end = new Date(t); end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end); start.setDate(start.getDate() - (weeks * 7 - 1));
    const out: number[] = [];
    for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const e = hydrated ? s.entries[iso(cur)] : undefined;
      out.push(e ? level(e.mins) : 0);
    }
    return out;
  }, [s.entries, hydrated]);

  return (
    <div className="groom3d">
      <Canvas shadows dpr={[1, 2]} frameloop={animate ? "always" : "demand"}>
        <OrthographicCamera makeDefault position={[10, 8.2, 10]} zoom={54} near={-50} far={100} />
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[6, 10, 5]} intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={-10} shadow-camera-far={40} />
        <pointLight position={[-5, 3, 4]} intensity={30} distance={16} color="#ffb055" />
        <pointLight position={[5, 2.4, -3]} intensity={26} distance={16} color="#5b8cff" />

        <group>
          <Floor />
          <Walls />
          <GarageDoor />
          <Desk />
          <Monitor animate={animate} />
          <Mug />
          <Whiteboard />
          <HeatPanel cells={cells} />
          {today && <Blueprint />}
          {has("gpurack") && <Rack x={1.6} z={-1.4} height={1.8} slats={4} animate={animate} />}
          {has("serverrack") && <Rack x={2.1} z={1.2} height={2.4} slats={6} animate={animate} />}
          {has("printer") && <Printer />}
          {has("robotarm") && <RobotArm animate={animate} />}
          {has("oscilloscope") && <Oscilloscope />}
          {has("toolwall") && <ToolWall />}
        </group>

        <OrbitControls makeDefault enableRotate={false} enablePan={false} enableZoom minZoom={38} maxZoom={150} target={[0, 1.2, 0]} />
      </Canvas>
      <GarageHud />
    </div>
  );
}
