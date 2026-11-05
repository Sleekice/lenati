import { getChildren } from '@lenati/graph';
import { ok, readOptions } from '@/lib/api';

export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const url = new URL(req.url);
  const skip = Math.max(0, Number(url.searchParams.get('skip')) || 0);
  const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take')) || 50));
  return ok(await getChildren(id, { ...readOptions(req), skip, take }));
}
