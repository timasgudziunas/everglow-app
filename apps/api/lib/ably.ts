import Ably from 'ably';

// Lazy singleton — deferred so module evaluation during build doesn't require ABLY_API_KEY.
let _rest: Ably.Rest | null = null;
export function getAblyRest(): Ably.Rest {
  if (!_rest) _rest = new Ably.Rest(process.env.ABLY_API_KEY!);
  return _rest;
}
