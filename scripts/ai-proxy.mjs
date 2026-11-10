// Shared proxy: forwards POST /__ai/chat/completions to the Meta Model API
// (or any OpenAI-compatible base URL the user set). The key travels per request
// in headers and is never stored server-side.
export async function aiProxy(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only'); }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString('utf8');
    const base = String(req.headers['x-ai-base'] || 'https://api.meta.ai/v1').replace(/\/+$/, '');
    if (!/^https:\/\//.test(base)) { res.statusCode = 400; return res.end('Base URL must be https'); }
    const path = (req.url || '/chat/completions').replace(/^\/+/, '/');
    const upstream = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: String(req.headers['authorization'] || '') },
      body,
    });
    res.statusCode = upstream.status;
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: String(e && e.message || e) }));
  }
}
