import { listHalls } from '@lenati/graph';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export async function GET() {
  return ok(await listHalls(), 300);
}
