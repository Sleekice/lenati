// Turns the prototype's data into graph rows. Pure (no database), so it is unit-tested directly.
//   body-tree.json    1,095 body structures (BodyParts3D-derived tree from body/src/tree.json)
//   micro-worlds.json 29 micro worlds and 229 parts (exported from body/src/micro.js)
import type { Level, Prisma } from '@prisma/client';

export interface TreeNode {
  id: string; name: string; common?: string; sys: string; what: string; does: string;
  kids: TreeNode[]; care?: string; conn?: string[]; hist?: [string, string][];
  ex?: number[]; mesh?: string; auto?: boolean; fma?: string; shapes?: unknown[]; c?: [number, number]; attach?: boolean;
}
export interface MicroPart { id: string; name: string; common: string | null; system: string; what: string; does: string; size: string | null; deeper: string | null }
export interface MicroWorld {
  id: string; level: string; name: string; common: string | null; system: string; unit: number; julia: [number, number];
  camera: number[]; radius: number; what: string; does: string; size: string | null; sources: string[]; history: [string, string][]; parts: MicroPart[];
}
export interface MicroData { worlds: MicroWorld[]; entries: { node: string; world: string }[] }

export const HALLS = [
  { id: 'biology', name: 'Biology', blurb: 'The human body, cells and molecules, plants, animals, ecology and genetics.', order: 0, open: true },
  { id: 'chemistry', name: 'Chemistry', blurb: 'Elements, bonds, reactions and the chemistry of life.', order: 1, open: false },
  { id: 'physics', name: 'Physics', blurb: 'Forces, energy, waves, electricity and the universe.', order: 2, open: false },
  { id: 'mathematics', name: 'Mathematics', blurb: 'Number, shape, pattern, chance and change.', order: 3, open: false },
  { id: 'earth-space', name: 'Earth and Space', blurb: 'Rocks, oceans, weather, planets and stars.', order: 4, open: false },
  { id: 'history', name: 'History', blurb: 'People, places and discoveries through time.', order: 5, open: false },
  { id: 'computer-science', name: 'Computer Science', blurb: 'Algorithms, machines, software and networks.', order: 6, open: false },
];

const WORLD_LEVEL: Record<string, Level> = { tissue: 'TISSUE', cell: 'CELL', organelle: 'ORGANELLE', chromatin: 'CHROMATIN', nucleosome: 'NUCLEOSOME', molecule: 'MOLECULE' };
const side = (name: string) => (/\bleft\b/i.test(name) ? 'left' : /\bright\b/i.test(name) ? 'right' : null);
const histMdx = (h: [string, string][]) => h.map(([y, t]) => `- **${y}**: ${t}`).join('\n');

export type NodeRow = Prisma.NodeCreateManyInput;
export interface Graph {
  /** Insertion batches: every node's parent is in an earlier batch. */
  batches: NodeRow[][];
  sections: Prisma.SectionCreateManyInput[];
  links: Prisma.LinkCreateManyInput[];
  droppedLinks: number;
  sources: string[];
  worldSources: [string, string[]][];
}

export function buildGraph(root: TreeNode, micro: MicroData): Graph {
  const rows: NodeRow[] = [], sections: Graph['sections'] = [], links: Graph['links'] = [];

  // ---------- body tree ----------
  const walk = (n: TreeNode, parentId: string | null, depth: number, order: number) => {
    const level: Level = depth === 0 ? 'BODY' : depth === 1 ? 'REGION' : depth === 2 ? 'ORGAN' : 'STRUCTURE';
    rows.push({
      id: n.id, hallId: 'biology', parentId, order, level, system: n.sys, side: side(n.name), name: n.name, commonName: n.common || null,
      fmaId: n.fma ?? null, meshRef: n.mesh ? `${n.mesh}#${n.id}` : null,
      fidelity: n.mesh ? 'SCANNED' : n.shapes && n.shapes.length ? 'SCHEMATIC' : null,
      explode: n.ex ? { vector: n.ex, attach: !!n.attach } : n.attach ? { attach: true } : undefined,
      world: n.c ? { julia: n.c } : undefined,
    });
    if (n.what) sections.push({ nodeId: n.id, kind: 'overview', bodyMdx: n.what });
    if (n.does) sections.push({ nodeId: n.id, kind: 'physiology', bodyMdx: n.does });
    if (n.care) sections.push({ nodeId: n.id, kind: 'care', bodyMdx: n.care });
    if (n.hist?.length) sections.push({ nodeId: n.id, kind: 'history', bodyMdx: histMdx(n.hist) });
    for (const c of n.conn ?? []) if (c !== n.id) links.push({ fromId: n.id, toId: c, type: 'CONNECTED_TO' });
    n.kids.forEach((k, i) => walk(k, n.id, depth + 1, i));
  };
  walk(root, null, 0, 0);

  // ---------- micro worlds ----------
  // A world can be reached from many places (every cell opens into "nucleus"). In the tree it gets one
  // parent, the first place that reaches it; every entry point keeps a deeperId pointing at it.
  const deeper = new Map<string, string>();
  for (const e of micro.entries) deeper.set(e.node, `w:${e.world}`);
  for (const w of micro.worlds) for (const p of w.parts) if (p.deeper) deeper.set(p.id, `w:${p.deeper}`);
  const home = new Map<string, string>();
  for (const e of micro.entries) if (!home.has(e.world)) home.set(e.world, e.node);
  for (const w of micro.worlds) for (const p of w.parts) if (p.deeper && !home.has(p.deeper)) home.set(p.deeper, p.id);

  const sources = new Set<string>(), worldSources: [string, string[]][] = [];
  for (const w of micro.worlds) {
    const wid = `w:${w.id}`, level = WORLD_LEVEL[w.level] ?? 'CONCEPT';
    rows.push({
      id: wid, hallId: 'biology', parentId: home.get(w.id) ?? 'body', level, system: w.system, name: w.name, commonName: w.common, sizeText: w.size,
      meshRef: `world:${w.id}`, fidelity: 'RECONSTRUCTED', world: { unit: w.unit, julia: w.julia, camera: w.camera, radius: w.radius },
    });
    sections.push({ nodeId: wid, kind: 'overview', bodyMdx: w.what }, { nodeId: wid, kind: 'physiology', bodyMdx: w.does });
    if (w.history.length) sections.push({ nodeId: wid, kind: 'history', bodyMdx: histMdx(w.history) });
    w.sources.forEach(s => sources.add(s));
    worldSources.push([wid, w.sources]);
    w.parts.forEach((p, i) => {
      rows.push({ id: p.id, hallId: 'biology', parentId: wid, order: i, level, system: p.system, name: p.name, commonName: p.common, sizeText: p.size, meshRef: `world:${w.id}#${p.id.split('/')[1] ?? p.id}`, fidelity: 'RECONSTRUCTED' });
      sections.push({ nodeId: p.id, kind: 'overview', bodyMdx: p.what }, { nodeId: p.id, kind: 'physiology', bodyMdx: p.does });
    });
  }
  for (const r of rows) { const d = deeper.get(r.id); if (d) r.deeperId = d; }

  // ---------- order: parents before children ----------
  const ids = new Set(rows.map(r => r.id));
  if (ids.size !== rows.length) {
    const seen = new Set<string>(); const dup = rows.filter(r => seen.has(r.id) || !seen.add(r.id)).map(r => r.id);
    throw new Error(`duplicate node ids: ${dup.slice(0, 10).join(', ')}`);
  }
  const batches: NodeRow[][] = [];
  const placed = new Set<string>();
  let pending = rows;
  while (pending.length) {
    const ready = pending.filter(r => !r.parentId || placed.has(r.parentId));
    if (!ready.length) throw new Error(`nodes whose parent never appears: ${pending.slice(0, 10).map(r => `${r.id} (parent ${r.parentId})`).join(', ')}`);
    ready.forEach(r => placed.add(r.id));
    batches.push(ready);
    pending = pending.filter(r => !placed.has(r.id));
  }

  const good = links.filter(l => ids.has(l.toId));
  const uniq = [...new Map(good.map(l => [`${l.fromId}|${l.toId}`, l])).values()];
  return { batches, sections: dedupeSections(sections), links: uniq, droppedLinks: links.length - good.length, sources: [...sources], worldSources };
}

/** One section per node and kind (the schema enforces it); the last one wins. */
function dedupeSections(s: Graph['sections']) {
  return [...new Map(s.filter(x => x.bodyMdx && x.bodyMdx.trim()).map(x => [`${x.nodeId}|${x.kind}`, x])).values()];
}
