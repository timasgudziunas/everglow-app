import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../lib/supabase-server';

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await createSupabaseServiceClient().auth.getUser(token);
  return user ?? null;
}

function isValidBody(body: unknown): body is { token: string; platform?: string } {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.token === 'string' && b.token.length > 0 &&
    (b.platform === undefined || typeof b.platform === 'string');
}

// POST /api/device-token — store (or refresh) the caller's push token so the relay
// can wake their app with a silent push. One row per user, upserted on user_id.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from('device_tokens')
    .upsert(
      {
        user_id: user.id,
        token: body.token,
        platform: body.platform ?? 'ios',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) return NextResponse.json({ error: 'Failed to store token' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
