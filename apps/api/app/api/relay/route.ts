import { NextResponse } from 'next/server';

// POST /api/relay — receive a beat event from the sender's phone and push it
// to the linked partner via Ably/Pusher. TODO: implement in Phase 3.
export async function POST() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
