import { NextResponse } from 'next/server';
import { db } from '@lenati/graph';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const nodes = await db.node.count();
    return NextResponse.json({ ok: true, db: 'up', nodes });
  } catch (e) {
    return NextResponse.json({ ok: false, db: 'down', error: (e as Error).message.split('\n')[0] }, { status: 503 });
  }
}
