import Ably from 'ably';

// REST client — sufficient for publishing from server routes without a persistent socket.
export const ablyRest = new Ably.Rest(process.env.ABLY_API_KEY!);
