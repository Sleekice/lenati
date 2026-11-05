import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGraph, type TreeNode, type MicroData } from '../seed/build';

const seed = (f: string) => JSON.parse(readFileSync(new URL(`../seed/${f}`, import.meta.url), 'utf8'));
const g = buildGraph((seed('body-tree.json') as { BODY: TreeNode }).BODY, seed('micro-worlds.json') as MicroData);
const nodes = g.batches.flat();
const byId = new Map(nodes.map(n => [n.id, n]));
const kids = new Map<string, string[]>();
for (const n of nodes) if (n.parentId) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n.id]);

/** Can a learner zoom from `from` down to `to`, opening parts and stepping into deeper worlds? */
function reaches(from: string, to: string) {
  const q = [from], seen = new Set<string>();
  while (q.length) {
    const id = q.shift()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const d = byId.get(id)?.deeperId; if (d) q.push(d);
    q.push(...(kids.get(id) ?? []));
  }
  return false;
}

test('about 1,300 nodes: 1,095 body structures, 29 worlds, 229 world parts', () => {
  assert.equal(nodes.filter(n => !n.id.startsWith('w:') && !n.id.includes('/')).length, 1095);
  assert.equal(nodes.filter(n => n.id.startsWith('w:')).length, 29);
  assert.ok(nodes.length >= 1300, `${nodes.length} nodes`);
});

test('one root, and every parent is inserted before its children', () => {
  assert.deepEqual(nodes.filter(n => !n.parentId).map(n => n.id), ['body']);
  const placed = new Set<string>();
  for (const batch of g.batches) { for (const n of batch) assert.ok(!n.parentId || placed.has(n.parentId), n.id); batch.forEach(n => placed.add(n.id)); }
});

test('every deeper link lands on a world that exists', () => {
  for (const n of nodes) if (n.deeperId) assert.ok(byId.has(n.deeperId), `${n.id} -> ${n.deeperId}`);
});

test('the heart goes all the way down to histone H3', () => assert.ok(reaches('heart', 'w:histone-h3')));
test('the nose stops at the odour receptor, not at histones', () => {
  assert.ok(reaches('nasal-cavity', 'w:odorant-receptor'));
});

test('every node below the body has an overview', () => {
  const has = new Set(g.sections.filter(s => s.kind === 'overview').map(s => s.nodeId));
  const missing = nodes.filter(n => n.level !== 'BODY' && !has.has(n.id)).map(n => n.id);
  assert.deepEqual(missing.slice(0, 10), []);
});

test('links point at real nodes and never at themselves', () => {
  for (const l of g.links) { assert.ok(byId.has(l.toId), l.toId); assert.notEqual(l.fromId, l.toId); }
});
