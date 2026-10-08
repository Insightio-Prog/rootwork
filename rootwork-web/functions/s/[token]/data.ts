// Cloudflare Pages Function: GET /s/<token>/data
// Streams the shared family backup (zip) to the app opened from /s/<token>.

type KV = {
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
};
type Env = { SHARE?: KV };
type Ctx = {
  env: Env;
  params: { token?: string | string[] };
  waitUntil: (promise: Promise<unknown>) => void;
};

const HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

function nope(status: number) {
  return new Response("Not available", { status, headers: HEADERS });
}

export async function onRequestGet({ env, params, waitUntil }: Ctx): Promise<Response> {
  const kv = env.SHARE;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  if (!kv || !token) return nope(404);
  const raw = await kv.get("current", "text");
  if (!raw) return nope(404);
  let current: { token: string; upload: string; count: number; size: number; kind?: string };
  try {
    current = JSON.parse(raw);
  } catch {
    return nope(503);
  }
  if (current.token !== token || current.kind !== "zip") return nope(404);

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
  return new Response(readable, { headers: { ...HEADERS, "content-type": "application/zip" } });
}
