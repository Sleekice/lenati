// Public surface of the knowledge graph. Every other package reads Lenati data through these functions,
// never through raw SQL, so tier rules and "published only" rules live in one place.
import { PrismaClient, Prisma, type Tier } from '@prisma/client';

export * from '@prisma/client';

import { tiersUpTo } from './tiers';
export { tiersUpTo };

const g = globalThis as unknown as { __lenatiPrisma?: PrismaClient };
/** One client per process, created on first use (Next.js dev reloads modules, so it is kept on globalThis).
 *  Lazy so that importing this package never fails: pages can catch a missing database and show a fallback. */
function client(): PrismaClient {
  if (!g.__lenatiPrisma) g.__lenatiPrisma = new PrismaClient();
  return g.__lenatiPrisma;
}
export const db = new Proxy({} as PrismaClient, {
  get(_, key) {
    const c = client();
    const v = Reflect.get(c, key, c);
    return typeof v === 'function' ? v.bind(c) : v;
  },
});

export interface ReadOptions {
  tier?: Tier;
  /** Include drafts. Only the admin area and the seed preview pass true. */
  includeDrafts?: boolean;
}
const visible = (o: ReadOptions = {}): Prisma.NodeWhereInput => ({
  minTier: { in: tiersUpTo(o.tier ?? 'CORE') },
  ...(o.includeDrafts ? {} : { status: 'PUBLISHED' as const }),
});

export function listHalls() {
  return db.hall.findMany({ orderBy: { order: 'asc' } });
}

/** One node with its sections, media, links and the ids of its children, filtered by tier. */
export async function getNode(id: string, o: ReadOptions = {}) {
  const tiers = tiersUpTo(o.tier ?? 'CORE');
  const node = await db.node.findFirst({
    where: { id, ...visible(o) },
    include: {
      sections: { where: { minTier: { in: tiers }, ...(o.includeDrafts ? {} : { status: 'PUBLISHED' }) }, include: { claims: { include: { sources: { include: { source: true } } } } } },
      media: { orderBy: { order: 'asc' } },
      linksFrom: { include: { to: { select: { id: true, name: true } } } },
      children: { where: visible(o), select: { id: true, name: true, level: true }, orderBy: { order: 'asc' } },
      parent: { select: { id: true, name: true } },
    },
  });
  return node;
}

/** Path from the root to a node, for breadcrumbs. */
export async function getLineage(id: string) {
  const out: { id: string; name: string }[] = [];
  let cur: string | null = id;
  for (let i = 0; cur && i < 40; i++) {
    const n: { id: string; name: string; parentId: string | null } | null = await db.node.findUnique({ where: { id: cur }, select: { id: true, name: true, parentId: true } });
    if (!n) break;
    out.unshift({ id: n.id, name: n.name });
    cur = n.parentId;
  }
  return out;
}

export function getChildren(id: string, o: ReadOptions & { skip?: number; take?: number } = {}) {
  return db.node.findMany({ where: { parentId: id, ...visible(o) }, orderBy: { order: 'asc' }, skip: o.skip ?? 0, take: Math.min(o.take ?? 100, 500), select: { id: true, name: true, commonName: true, level: true, system: true, deeperId: true } });
}

/** Name, common-name and Latin-name search. Postgres full-text search replaces this in sprint 3. */
export function search(q: string, o: ReadOptions & { take?: number } = {}) {
  const term = q.trim();
  if (term.length < 2) return Promise.resolve([]);
  return db.node.findMany({
    where: { ...visible(o), OR: [{ name: { contains: term, mode: 'insensitive' } }, { commonName: { contains: term, mode: 'insensitive' } }, { latinName: { contains: term, mode: 'insensitive' } }] },
    select: { id: true, name: true, commonName: true, level: true, system: true },
    take: Math.min(o.take ?? 20, 50),
    orderBy: { name: 'asc' },
  });
}
