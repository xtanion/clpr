// Types only. All content values now come from the backend via GET /api/content
// (see lib/content.ts). Nothing here is hardcoded data.

export type ResType = "read" | "code" | "video" | "paper";
export type Resource = { label: string; url: string; type: ResType };
export type GistAvail = { modes: string[]; version: string };
export type Topic = { label: string; res: Resource[]; build?: boolean; gists?: GistAvail };
export type Stage = { alt: string; title: string; blurb: string; topics: Topic[] };

export type Weight = "full" | "reduced";
export type QNumeric = { type: "numeric"; weight: Weight; prompt: string; hint: string; answer: number; tolerance: number; unit: string };
export type QCode = { type: "code"; weight: Weight; prompt: string; signature: string; entry: string; tests: { args: unknown[]; expected: unknown }[] };
export type QFree = { type: "free"; weight: Weight; prompt: string; rubric: string[]; keywords: string[] };
export type Question = QNumeric | QCode | QFree;
export type Quiz = { stage: number; questions: Question[] };

export type Mat = "steel" | "bearings" | "titanium" | "carbon";
export type Mats = Partial<Record<Mat, number>>;
export type Artifact = { id: string; name: string; blurb: string; req: number; cost: Mats };

export type Friend = { name: string; handle: string; xp: number; stage: number; streak: number };
export type RaceRunner = { name: string; ms: number; score: number };

export type World = { id: string; name: string; camps: number[] };
export type TreeNode = { id: string; label: string; children?: TreeNode[]; climb?: string };
export type Genre = { id: string; name: string; desc: string; status: "active" | "soon"; stages: number; topics: number; href?: string };
