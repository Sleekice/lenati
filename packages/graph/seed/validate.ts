// Integrity checks for the knowledge graph. Exits non-zero on any failure, so CI can run it after seeding.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const failures: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) failures.push(msg); };

async function main() {
  const nodes = await db.node.findMany({ select: { id: true, parentId: true, deeperId: true, level: true, name: true } });
  const ids = new Set(nodes.map(n => n.id));
  const byId = new Map(nodes.map(n => [n.id, n]));

  check(nodes.length >= 1300, `expected at least 1,300 nodes, found ${nodes.length}`);
  const roots = nodes.filter(n => !n.parentId);
  check(roots.length === 1 && roots[0].id === 'body', `expected one root "body", found ${roots.map(r => r.id).join(', ') || 'none'}`);
  for (const n of nodes) {
    if (n.parentId && !ids.has(n.parentId)) failures.push(`${n.id}: parent ${n.parentId} missing`);
    if (n.deeperId && !ids.has(n.deeperId)) failures.push(`${n.id}: deeper world ${n.deeperId} missing`);
    if (!n.name.trim()) failures.push(`${n.id}: empty name`);
  }
  // every node reaches the root without a cycle
  for (const n of nodes) {
    const seen = new Set<string>(); let cur: string | null = n.id;
    while (cur) { if (seen.has(cur)) { failures.push(`${n.id}: cycle through ${cur}`); break; } seen.add(cur); cur = byId.get(cur)?.parentId ?? null; }
  }
  // the deepest promise: from the heart you can reach a histone
  const reach = (from: string, target: string) => {
    const q = [from], seen = new Set<string>();
    while (q.length) { const id = q.shift()!; if (id === target) return true; if (seen.has(id)) continue; seen.add(id);
      const n = byId.get(id); if (n?.deeperId) q.push(n.deeperId); nodes.filter(c => c.parentId === id).forEach(c => q.push(c.id)); }
    return false;
  };
  check(reach('heart', 'w:histone-h3'), 'heart does not reach histone H3');
  check(reach('nasal-cavity', 'w:odorant-receptor'), 'nose does not reach the odour receptor');
  const noOverview = await db.node.count({ where: { sections: { none: { kind: 'overview' } }, level: { not: 'BODY' } } });
  check(noOverview === 0, `${noOverview} nodes have no overview section`);

  const levels = await db.node.groupBy({ by: ['level'], _count: true });
  console.log('nodes by level', Object.fromEntries(levels.map(l => [l.level, l._count])));
  if (failures.length) { console.error(`FAILED (${failures.length})\n` + failures.slice(0, 40).join('\n')); process.exit(1); }
  console.log(`OK: ${nodes.length} nodes, graph is a single tree, every deeper link resolves, heart reaches histone H3`);
}
main().finally(() => db.$disconnect());
