"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { TreeNode } from "@/lib/data";
import { useContent } from "@/lib/content";
import { useClpr, useHydrated, campUnlocked, stageDoneCount, clprCleared } from "@/lib/store";
import { Lock, Clock } from "@/components/ui/icons";

export function Tree() {
  const s = useClpr();
  const hydrated = useHydrated();
  const { tree: csTree, roadmap, worlds } = useContent();
  const [open, setOpen] = useState<Record<string, boolean>>({ compsci: true, ai: true, "llm-inference": true, fundamentals: true });
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const rows: ReactNode[] = [];

  function branchRow(id: string, label: string, prefix: string, connector: string, expanded: boolean, onClick: () => void, locked = false) {
    return (
      <button key={id} className="tree-row branch" onClick={onClick} disabled={locked}>
        <span className="tree-prefix">{prefix + connector}</span>
        <span className="tree-caret">{locked ? " " : expanded ? "-" : "+"}</span>
        <span className={`tree-label${locked ? " locked" : ""}`}>{label}/</span>
        {locked && <span className="tree-soon" title="locked" aria-label="locked"><Lock size={12} /></span>}
      </button>
    );
  }

  function renderCamp(campId: number, prefix: string, isLast: boolean) {
    const connector = isLast ? "└─ " : "├─ ";
    const camp = roadmap[campId];
    const unlocked = hydrated ? campUnlocked(s, campId) : campId === 0;
    const done = hydrated ? stageDoneCount(s, campId) : 0;
    const cleared = hydrated && clprCleared(s, campId);

    if (!unlocked) {
      rows.push(
        <div key={`camp${campId}`} className="tree-row soon">
          <span className="tree-prefix">{prefix + connector}</span>
          <span className="tree-label">{camp.alt}</span>
          <span className="tree-soon" title="locked" aria-label="locked"><Lock size={12} /></span>
        </div>,
      );
      return;
    }
    rows.push(
      <Link key={`camp${campId}`} href={`/climb?topic=llm-inference&camp=${campId}`} className="tree-row climbable">
        <span className="tree-prefix">{prefix + connector}</span>
        <span className="tree-label">{camp.alt}</span>
        <span className={`tree-frac ${cleared ? "sev-ok" : done > 0 ? "sev-info" : "sev-dim"}`}>{cleared ? "summited" : `${done}/${camp.topics.length}`}</span>
        <span className="tree-arrow sev-ok">{"->"}</span>
      </Link>,
    );
  }

  function renderWorld(wi: number, prefix: string, isLast: boolean) {
    const world = worlds[wi];
    const connector = isLast ? "└─ " : "├─ ";
    const unlocked = hydrated ? campUnlocked(s, world.camps[0]) : world.camps[0] === 0;
    const expanded = !!open[world.id];
    rows.push(branchRow(world.id, world.name, prefix, connector, expanded, () => toggle(world.id), !unlocked));
    if (expanded && unlocked) {
      const childPrefix = prefix + (isLast ? "   " : "│  ");
      world.camps.forEach((campId, ci) => renderCamp(campId, childPrefix, ci === world.camps.length - 1));
    }
  }

  function walk(node: TreeNode, prefix: string, isRoot: boolean, isLast: boolean) {
    const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";
    const isLlm = node.climb === "llm-inference";
    const expanded = !!open[node.id];

    if (isLlm) {
      rows.push(branchRow(node.id, node.label, prefix, connector, expanded, () => toggle(node.id)));
      if (expanded) {
        const childPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");
        worlds.forEach((_, wi) => renderWorld(wi, childPrefix, wi === worlds.length - 1));
      }
      return;
    }

    if (node.children?.length) {
      rows.push(branchRow(node.id, node.label, prefix, connector, expanded, () => toggle(node.id)));
      if (expanded) {
        const childPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");
        node.children.forEach((k, i) => walk(k, childPrefix, false, i === node.children!.length - 1));
      }
      return;
    }

    rows.push(
      <div key={node.id} className="tree-row soon">
        <span className="tree-prefix">{prefix + connector}</span>
        <span className="tree-label">{node.label}</span>
        <span className="tree-soon" title="coming soon" aria-label="coming soon"><Clock size={12} /></span>
      </div>,
    );
  }

  walk(csTree, "", true, true);

  return <div className="tree">{rows}</div>;
}
