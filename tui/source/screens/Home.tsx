import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, useInput} from 'ink';
import type {ScreenProps} from '../app.js';
import type {Content, State, TreeNode} from '../types.js';
import * as sel from '../state.js';
import {useTheme, ICON} from '../theme.js';

type Node = {
	id: string;
	label: string;
	kind: 'branch' | 'camp' | 'soon';
	expandable: boolean;
	children?: Node[];
	camp?: number;
	frac?: string;
	done?: boolean;
	cleared?: boolean;
	locked?: boolean;
};

function buildTree(content: Content, st: State): Node {
	const {tree, worlds, roadmap} = content;

	const campNode = (campId: number): Node => {
		const camp = roadmap[campId]!;
		if (!sel.campUnlocked(content, st, campId))
			return {id: `c${campId}`, label: camp.alt, kind: 'camp', expandable: false, locked: true, camp: campId};
		const done = sel.stageDoneCount(content, st, campId);
		const cleared = sel.clprCleared(st, campId);
		return {
			id: `c${campId}`,
			label: camp.alt,
			kind: 'camp',
			expandable: false,
			camp: campId,
			frac: cleared ? 'summited' : `${done}/${camp.topics.length}`,
			done: done > 0,
			cleared,
		};
	};

	const worldNode = (wi: number): Node => {
		const w = worlds[wi]!;
		const unlocked = sel.campUnlocked(content, st, w.camps[0]!);
		return {
			id: w.id,
			label: w.name,
			kind: 'branch',
			expandable: unlocked,
			locked: !unlocked,
			children: unlocked ? w.camps.map(campNode) : [],
		};
	};

	const walk = (node: TreeNode): Node => {
		if (node.climb === 'llm-inference')
			return {id: node.id, label: node.label, kind: 'branch', expandable: true, children: worlds.map((_, wi) => worldNode(wi))};
		if (node.children?.length)
			return {id: node.id, label: node.label, kind: 'branch', expandable: true, children: node.children.map(walk)};
		return {id: node.id, label: node.label, kind: 'soon', expandable: false};
	};

	return walk(tree);
}

type Row = {node: Node; prefix: string};

function flatten(node: Node, prefix: string, isRoot: boolean, isLast: boolean, isExpanded: (id: string) => boolean, rows: Row[]) {
	const connector = isRoot ? '' : isLast ? '└─ ' : '├─ ';
	rows.push({node, prefix: prefix + connector});
	if (node.expandable && isExpanded(node.id) && node.children?.length) {
		const childPrefix = isRoot ? '' : prefix + (isLast ? '   ' : '│  ');
		node.children.forEach((c, i) => flatten(c, childPrefix, false, i === node.children!.length - 1, isExpanded, rows));
	}
}

const selectable = (n: Node) => (n.kind === 'branch' && n.expandable) || (n.kind === 'camp' && !n.locked);

// Ancestor branch ids leading to the camp the user is reading, so we open only that path.
function pathToCamp(node: Node, focus: number, acc: string[]): string[] | null {
	if (node.kind === 'camp') return node.camp === focus ? acc : null;
	for (const c of node.children ?? []) {
		const r = pathToCamp(c, focus, [...acc, node.id]);
		if (r) return r;
	}
	return null;
}

export function Home({content, st, nav, readingCamp}: ScreenProps) {
	const theme = useTheme();
	const root = useMemo(() => buildTree(content, st), [content, st]);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [selectedId, setSelectedId] = useState<string | null>(null);

	// The chapter you're on: last camp opened, else the next objective's stage.
	const objStage = sel.nextObjective(content, st).stage;
	const focusCamp = readingCamp >= 0 ? readingCamp : objStage >= 0 ? objStage : 0;
	const pathSet = useMemo(() => new Set(pathToCamp(root, focusCamp, []) ?? []), [root, focusCamp]);

	// Re-focus the tree on the current chapter whenever it changes: reset manual
	// expand/collapse and select the current camp.
	useEffect(() => {
		setExpanded({});
		setSelectedId(`c${focusCamp}`);
	}, [focusCamp]);

	const isExpanded = (id: string) => expanded[id] ?? pathSet.has(id);

	const rows: Row[] = [];
	flatten(root, '', true, true, isExpanded, rows);
	const selIds = rows.filter(r => selectable(r.node)).map(r => r.node.id);
	const active = selectedId && selIds.includes(selectedId) ? selectedId : `c${focusCamp}`;

	useInput((input, key) => {
		if (selIds.length === 0) return;
		const cur = selIds.indexOf(active);
		if (key.upArrow) setSelectedId(selIds[(cur - 1 + selIds.length) % selIds.length]!);
		else if (key.downArrow) setSelectedId(selIds[(cur + 1) % selIds.length]!);
		else if (key.return || input === ' ') {
			const node = rows.find(r => r.node.id === active)?.node;
			if (!node) return;
			if (node.kind === 'branch') setExpanded(e => ({...e, [node.id]: !isExpanded(node.id)}));
			else if (node.kind === 'camp' && node.camp !== undefined) nav.openClimb(node.camp);
		}
	});

	return (
		<Box flexDirection="column">
			<Text color={theme.muted}>// flavours</Text>
			{rows.map(({node, prefix}) => {
				const isSel = node.id === active;
				const isExp = isExpanded(node.id);
				const caret = node.expandable ? (isExp ? ICON.caretOpen : ICON.caretClosed) + ' ' : '';
				return (
					<Text key={node.id}>
						<Text color={theme.accent} bold>
							{isSel ? ICON.pointer + ' ' : '  '}
						</Text>
						<Text color={theme.muted}>{prefix}</Text>
						{caret ? <Text color={theme.muted}>{caret}</Text> : null}
						{node.kind === 'camp' ? (
							<>
								<Text
									color={node.locked ? theme.muted : isSel ? theme.accent : node.cleared ? theme.muted : undefined}
									bold={isSel}
									strikethrough={node.cleared}
								>
									{node.label}
								</Text>
								{node.locked ? (
									<Text color={theme.warn}> {ICON.lock}</Text>
								) : (
									<>
										<Text> </Text>
										<Text color={node.cleared || node.done ? theme.accent : theme.muted}>{node.frac}</Text>
										<Text color={theme.accent}> {ICON.arrow}</Text>
									</>
								)}
							</>
						) : node.kind === 'soon' ? (
							<Text color={theme.muted} dimColor>
								{node.label} <Text color={theme.info}>{ICON.soon}</Text>
							</Text>
						) : (
							<>
								<Text color={isSel ? theme.accent : undefined} bold={isSel}>
									{node.label}/
								</Text>
								{node.locked ? <Text color={theme.warn}> {ICON.lock}</Text> : null}
							</>
						)}
					</Text>
				);
			})}
		</Box>
	);
}
