// Seeds the knowledge graph from the prototype's data (see build.ts for the mapping).
// Everything lands as DRAFT; nothing is public until a reviewer publishes it.
// Re-running is safe: content tables are cleared and rebuilt; accounts, consents and outreach are left alone.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildGraph, HALLS, type TreeNode, type MicroData } from './build';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PrismaClient();
const load = <T>(f: string) => JSON.parse(readFileSync(join(here, f), 'utf8')) as T;

async function main() {
  const t0 = Date.now();
  const g = buildGraph(load<{ BODY: TreeNode }>('body-tree.json').BODY, load<MicroData>('micro-worlds.json'));

  await db.$transaction([
    db.claimSource.deleteMany(), db.claim.deleteMany(), db.section.deleteMany(), db.media.deleteMany(), db.link.deleteMany(),
    db.pathStep.deleteMany(), db.path.deleteMany(), db.articleNode.deleteMany(), db.article.deleteMany(), db.question.deleteMany(),
    db.progress.deleteMany(), db.node.deleteMany(), db.source.deleteMany(), db.hall.deleteMany(),
  ]);
  await db.hall.createMany({ data: HALLS });
  for (const batch of g.batches) await db.node.createMany({ data: batch });
  await db.section.createMany({ data: g.sections });
  await db.link.createMany({ data: g.links, skipDuplicates: true });

  // sources: one claim per world overview, tied to the citations on that world's card
  await db.source.createMany({
    data: g.sources.map(citation => ({ citation, kind: /\(\d{4}\)|Nature|Science|Cell\b|J\.|Annu/.test(citation) ? 'paper' : 'textbook', doi: citation.match(/doi:\s*(\S+)/i)?.[1] ?? null })),
  });
  const srcId = new Map((await db.source.findMany({ select: { id: true, citation: true } })).map(s => [s.citation, s.id]));
  const overview = new Map((await db.section.findMany({ where: { kind: 'overview', nodeId: { startsWith: 'w:' } }, select: { id: true, nodeId: true } })).map(s => [s.nodeId, s.id]));
  for (const [wid, cites] of g.worldSources) {
    const sectionId = overview.get(wid);
    if (!sectionId || !cites.length) continue;
    await db.claim.create({ data: { sectionId, text: 'Sources for this card', sources: { create: [...new Set(cites)].map(c => ({ sourceId: srcId.get(c)! })) } } });
  }

  // legal documents: drafts until a lawyer reviews them
  for (const [id, title] of [['terms', 'Terms of use'], ['privacy', 'Privacy policy'], ['disclaimer', 'Educational use disclaimer']] as const) {
    await db.legalDocument.upsert({ where: { id }, update: {}, create: { id, version: '0.1-draft', bodyMdx: `# ${title}\n\nDraft for development only. Not legally reviewed. Replace before launch.` } });
  }

  const nodes = g.batches.flat();
  console.log(JSON.stringify({
    halls: HALLS.length, nodes: nodes.length, worlds: nodes.filter(n => n.id.startsWith('w:')).length,
    sections: g.sections.length, links: g.links.length, droppedLinks: g.droppedLinks, sources: g.sources.length,
    seconds: +((Date.now() - t0) / 1000).toFixed(1),
  }, null, 2));
}

main().then(() => db.$disconnect()).catch(async e => { console.error(e); await db.$disconnect(); process.exit(1); });
