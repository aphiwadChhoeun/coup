import { CoupRoom } from './room.js';

export { CoupRoom };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'coup-online', now: Date.now() });
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{4,8})\/ws$/);
    if (!match) {
      return json({ error: 'Not found' }, 404);
    }

    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return json({ error: 'Expected a WebSocket upgrade' }, 426);
    }

    const code = match[1].toUpperCase();
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    return stub.fetch(request);
  }
};
