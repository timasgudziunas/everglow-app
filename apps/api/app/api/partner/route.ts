import { NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '../../../lib/supabase-server';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I/L
const CODE_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await createSupabaseServiceClient().auth.getUser(token);
  return user ?? null;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const service = createSupabaseServiceClient();

  if (body.action === 'generate') {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    // One code per user — delete any existing one first
    await service.from('invite_codes').delete().eq('user_id', user.id);

    const { error } = await service
      .from('invite_codes')
      .insert({ code, user_id: user.id, expires_at: expiresAt });

    if (error) return Response.json({ error: 'Failed to generate code' }, { status: 500 });

    return Response.json({ code, expiresAt });
  }

  if (body.action === 'redeem') {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : null;
    if (!code) return Response.json({ error: 'code is required' }, { status: 400 });

    const { data: invite } = await service
      .from('invite_codes')
      .select('id, user_id, expires_at')
      .eq('code', code)
      .maybeSingle();

    if (!invite) return Response.json({ error: 'Invalid code' }, { status: 404 });
    if (new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: 'Code has expired' }, { status: 410 });
    }
    if (invite.user_id === user.id) {
      return Response.json({ error: 'Cannot link to yourself' }, { status: 400 });
    }

    // Check neither user is already linked
    const { data: existing } = await service
      .from('partner_links')
      .select('id')
      .or(`user_id.eq.${user.id},partner_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();

    if (existing) return Response.json({ error: 'Already linked to a partner' }, { status: 409 });

    const { error: linkError } = await service
      .from('partner_links')
      .insert({ user_id: invite.user_id, partner_id: user.id });

    if (linkError) return Response.json({ error: 'Failed to link partners' }, { status: 500 });

    // Delete the used code — redeemer can't do this via RLS so service client is required
    await service.from('invite_codes').delete().eq('id', invite.id);

    return Response.json({ partnerId: invite.user_id });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
