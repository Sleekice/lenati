import { getNode, getLineage } from '@lenati/graph';
import { ok, notFound, readOptions } from '@/lib/api';

export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const node = await getNode(id, readOptions(req));
  if (!node) return notFound(`node ${id}`);
  return ok({ ...node, lineage: await getLineage(id) });
}
