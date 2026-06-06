import { NextRequest, NextResponse } from 'next/server';
import { ablyRest } from '../../../lib/ably';
import { createSupabaseServiceClient } from '../../../lib/supabase-server';

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await createSupabaseServiceClient().auth.getUser(token);
  return user ?? null;
}

// POST /api/ably-auth — return a scoped Ably token request so the mobile client
// can subscribe to its own beats channel without exposing the API key.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tokenRequest = await ablyRest.auth.createTokenRequest({
    clientId: user.id,
    capability: { [`beats:${user.id}`]: ['subscribe'] },
  });

  return NextResponse.json(tokenRequest);
}
