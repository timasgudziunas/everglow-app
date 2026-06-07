import { NextRequest, NextResponse } from 'next/server';
import { getAblyRest } from '../../../lib/ably';
import { createSupabaseServiceClient } from '../../../lib/supabase-server';

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await createSupabaseServiceClient().auth.getUser(token);
  return user ?? null;
}

function isValidBeatEvent(body: unknown): body is {
  timestampMs: number;
  intervalMs: number;
  sequence: number;
  checksum: number;
} {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.timestampMs === 'number' &&
    typeof b.intervalMs === 'number' &&
    typeof b.sequence === 'number' &&
    typeof b.checksum === 'number'
  );
}

// POST /api/relay — receive a beat event from the sender's phone and publish it
// to the linked partner's Ably channel (`beats:{partnerId}`).
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidBeatEvent(body)) {
    return NextResponse.json({ error: 'Invalid beat event' }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { data: link } = await service
    .from('partner_links')
    .select('user_id, partner_id')
    .or(`user_id.eq.${user.id},partner_id.eq.${user.id}`)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: 'No partner link found' }, { status: 404 });

  const partnerId = link.user_id === user.id ? link.partner_id : link.user_id;

  await getAblyRest().channels.get(`beats:${partnerId}`).publish('beat', body);

  return NextResponse.json({ ok: true });
}
