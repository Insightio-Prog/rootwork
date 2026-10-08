// Cloudflare Pages Function: GET /s/<token>
// Serves the shared view-only family page stored by /api/share.

type KV = {
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
};
type Env = { SHARE?: KV };
type Ctx = {
  request: Request;
  env: Env;
  params: { token?: string | string[] };
  waitUntil: (promise: Promise<unknown>) => void;
};

const BASE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

function page(message: string, status: number) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rootwork</title><body style="font-family:system-ui,sans-serif;background:#f5ead9;color:#2b2118;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center"><div><h1 style="font-weight:500">Rootwork</h1><p>${message}</p></div></body>`;
  return new Response(html, { status, headers: { ...BASE_HEADERS, "content-type": "text/html; charset=utf-8" } });
}

export async function onRequestGet({ env, params, waitUntil }: Ctx): Promise<Response> {
  const kv = env.SHARE;
  if (!kv) return page("This family link is not switched on.", 404);
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const raw = await kv.get("current", "text");
  if (!token || !raw) return page("This family link isn't available any more. Ask whoever sent it for a new one.", 404);
  let current: { token: string; upload: string; count: number; size: number };
  try {
    current = JSON.parse(raw);
  } catch {
    return page("This family link isn't available right now. Please try again in a minute.", 503);
  }
  if (current.token !== token) {
    return page("This family link isn't available any more. Ask whoever sent it for a new one.", 404);
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  waitUntil(
    (async () => {
      try {
        for (let i = 0; i < current.count; i++) {
          const piece = await kv.get(`data:${current.upload}:${i}`, "arrayBuffer");
          if (!piece) throw new Error("missing piece");
          await writer.write(new Uint8Array(piece));
        }
        await writer.close();
      } catch (err) {
        await writer.abort(err);
      }
    })(),
  );
  return new Response(readable, {
    headers: { ...BASE_HEADERS, "content-type": "text/html; charset=utf-8" },
  });
}
