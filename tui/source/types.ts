// Domain types mirrored from the web client (app/lib/data.ts, app/lib/store.ts).

export type ResType = 'read' | 'code' | 'video' | 'paper';
export type Resource = {label: string; url: string; type: ResType};
export type GistAvail = {modes: string[]; version: string};
export type Topic = {
	label: string;
	res: Resource[];
	build?: boolean;
	gists?: GistAvail;
};
export type Stage = {alt: string; title: string; blurb: string; topics: Topic[]};

export type Weight = 'full' | 'reduced';
export type Question = {
	type: 'numeric' | 'code' | 'free';
	weight: Weight;
	prompt: string;
	hint?: string;
	// numeric
	answer?: number;
	tolerance?: number;
	unit?: string;
	// code
	signature?: string;
	entry?: string;
	tests?: {args: unknown[]; expected: unknown}[];
	// free
	rubric?: string[];
	keywords?: string[];
};
export type Quiz = {stage: number; questions: Question[]};

export type Mat = 'steel' | 'bearings' | 'titanium' | 'carbon';
export type Artifact = {
	id: string;
	name: string;
	blurb: string;
	req: number;
	cost: Partial<Record<Mat, number>>;
};

export type World = {id: string; name: string; camps: number[]};
export type TreeNode = {
	id: string;
	label: string;
	children?: TreeNode[];
	climb?: string;
};

export type Content = {
	roadmap: Stage[];
	totalTopics: number;
	quizzes: Quiz[];
	tree: TreeNode;
	worlds: World[];
	artifacts: Artifact[];
	campMaterials: Partial<Record<Mat, number>>[];
	[key: string]: unknown;
};

export type Entry = {
	mins: string;
	summary: string;
};
export type Attempt = {
	id: number;
	stage: number;
	score: number;
	passed: boolean;
	timeMs: number;
	xp: number;
	firstClear: boolean;
	at: string;
};
export type Comment = {id: number; author: string; text: string; at: string};

export type State = {
	entries: Record<string, Entry>;
	progress: Record<string, boolean>;
	startDate: string;
	attempts: Attempt[];
	ledger: {source: number; xp: number; at: string}[];
	comments: Record<string, Comment[]>;
	artifacts: string[];
};

export const EMPTY_STATE: State = {
	entries: {},
	progress: {},
	startDate: '',
	attempts: [],
	ledger: [],
	comments: {},
	artifacts: [],
};

export type Profile = {
	id: string;
	email: string;
	name: string;
	username: string;
	avatarUrl: string;
	provider: string;
};

export type BoardRow = {
	name: string;
	xp: number;
	stage: number;
	streak: number;
	rank: number;
	me: boolean;
};
export type RaceRow = {name: string; ms: number; score: number; me: boolean};
