import { NextResponse } from 'next/server';
import type { ReadOptions } from '@lenati/graph';

/** Read options from the query string. Sprint 1 has no accounts, so everyone reads as CORE; ?drafts=1 shows seeded drafts outside production. */
export function readOptions(req: Request): ReadOptions {
  const url = new URL(req.url);
  const drafts = url.searchParams.get('drafts') === '1' && process.env.NODE_ENV !== 'production';
  return { tier: 'CORE', includeDrafts: drafts };
}

export const ok = (data: unknown, maxAge = 60) =>
  NextResponse.json({ data }, { headers: { 'cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate=600` } });

export const notFound = (what: string) => NextResponse.json({ error: { code: 'not_found', message: `${what} not found` } }, { status: 404 });
