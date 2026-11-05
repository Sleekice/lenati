import { NextResponse } from 'next/server';
import { search } from '@lenati/graph';
import { ok, readOptions } from '@/lib/api';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ error: { code: 'bad_request', message: 'q must be at least 2 characters' } }, { status: 400 });
  return ok(await search(q, readOptions(req)), 30);
}
