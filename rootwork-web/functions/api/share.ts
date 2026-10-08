// Cloudflare Pages Function: POST /api/share
// Publishes the family backup (zip) so the full app can be opened from one link (/s/<token>).
// Needs a KV namespace bound as SHARE (see wrangler.toml) and the same FAMILY_PASSWORD secret.
//
//   ?action=status                          who is sharing, and when it was last updated
//   ?action=start                           begin an upload, returns an upload id
//   ?action=chunk&upload=ID&i=N   (body)    store piece N of the page
//   ?action=finish&upload=ID&count=N&size=S&kind=zip[&rotate=1]   switch the link over to the new upload
//   ?action=stop                            stop sharing (the link stops working)

type KV = {
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  put(key: string, value: string | ArrayBuffer): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string }): Promise<{ keys: { name: string }[] }>;
};
type Env = { FAMILY_PASSWORD?: string; SHARE?: KV };
type Ctx = { request: Request; env: Env };
type Current = { token: string; upload: string; count: number; size: number; updatedAt: string; kind?: "zip" };

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };
const MAX_CHUNK = 8 * 1024 * 1024;
const MAX_CHUNKS = 40;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function passwordOk(given: string, expected: string) {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function randomId(bytes: number) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let text = "";
  for (const byte of data) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readCurrent(kv: KV): Promise<Current | null> {
  const raw = await kv.get("current", "text");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Current;
  } catch {
    return null;
  }
}

/** Remove stored pieces that no longer belong to the live page. */
async function sweep(kv: KV, keepUpload: string | null) {
  const { keys } = await kv.list({ prefix: "data:" });
  let removed = 0;
  for (const { name } of keys) {
    if (keepUpload && name.startsWith(`data:${keepUpload}:`)) continue;
    if (removed >= 40) break;
    await kv.delete(name);
    removed += 1;
  }
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!env.FAMILY_PASSWORD) return reply({ error: "The family password isn't set up on the server yet." }, 500);
  const kv = env.SHARE;
  if (!kv) {
    return reply({ error: "Link sharing isn't switched on yet. The SHARE storage has not been connected." }, 501);
  }
  const given = request.headers.get("x-family-password") ?? "";
  if (!(await passwordOk(given, env.FAMILY_PASSWORD))) return reply({ error: "That password isn't right." }, 401);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "";

  if (action === "status") {
    const current = await readCurrent(kv);
    return reply(
      current
        ? { shared: true, token: current.token, size: current.size, updatedAt: current.updatedAt }
        : { shared: false },
    );
  }

  if (action === "start") return reply({ upload: randomId(9) });

  if (action === "chunk") {
    const upload = url.searchParams.get("upload") ?? "";
    const index = Number(url.searchParams.get("i"));
    if (!/^[A-Za-z0-9_-]{6,24}$/.test(upload) || !Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS) {
      return reply({ error: "Bad upload piece." }, 400);
    }
    const body = await request.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_CHUNK) return reply({ error: "That piece is the wrong size." }, 400);
    await kv.put(`data:${upload}:${index}`, body);
    return reply({ ok: true });
  }

  if (action === "finish") {
    const upload = url.searchParams.get("upload") ?? "";
    const count = Number(url.searchParams.get("count"));
    const size = Number(url.searchParams.get("size"));
    if (!/^[A-Za-z0-9_-]{6,24}$/.test(upload) || !Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) {
      return reply({ error: "Bad upload." }, 400);
    }
    const lastPiece = await kv.get(`data:${upload}:${count - 1}`, "arrayBuffer");
    if (lastPiece === null) return reply({ error: "The upload did not arrive in full. Try again." }, 400);
    const existing = await readCurrent(kv);
    const rotate = url.searchParams.get("rotate") === "1";
    const next: Current = {
      token: existing && !rotate ? existing.token : randomId(24),
      upload,
      count,
      size: Number.isFinite(size) ? size : 0,
      kind: url.searchParams.get("kind") === "zip" ? "zip" : undefined,
      updatedAt: new Date().toISOString(),
    };
    await kv.put("current", JSON.stringify(next));
    await sweep(kv, upload);
    return reply({ shared: true, token: next.token, size: next.size, updatedAt: next.updatedAt });
  }

  if (action === "stop") {
    await kv.delete("current");
    await sweep(kv, null);
    return reply({ shared: false });
  }

  return reply({ error: "Unknown action." }, 400);
}

export async function onRequest({ request }: Ctx): Promise<Response> {
  return reply({ error: "Use POST." }, request.method === "OPTIONS" ? 204 : 405);
}
