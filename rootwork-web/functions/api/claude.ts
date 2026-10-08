// Cloudflare Pages Function: POST /api/claude
// Holds the Anthropic key server-side and only answers people who know the family password.
// Secrets (set in the Cloudflare dashboard, never in the repo):
//   ANTHROPIC_API_KEY  - your Anthropic key
//   FAMILY_PASSWORD    - the password you give family to unlock Claude

type Env = { ANTHROPIC_API_KEY?: string; FAMILY_PASSWORD?: string };
type Ctx = { request: Request; env: Env };
type Json = Record<string, any>;

// Ask uses Haiku (fast and cheap); Sonnet is the fallback if Haiku is unavailable.
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-sonnet-4-6"];
const MAX_BODY = 40 * 1024 * 1024;
const MAX_TEXT = 400_000;

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

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

async function postAnthropic(key: string, body: Json): Promise<Json> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    const message = payload?.error?.message ?? "Anthropic request failed";
    throw new Error(`${message} (${response.status})`);
  }
  return payload;
}

async function withModels<T>(run: (model: string) => Promise<T>): Promise<T> {
  let last = new Error("No model available.");
  for (const model of MODELS) {
    try {
      return await run(model);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (/not_found|404/.test(error.message)) {
        last = error;
        continue;
      }
      throw error;
    }
  }
  throw last;
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY || !env.FAMILY_PASSWORD) {
    return reply({ error: "Claude is not set up on this site yet." }, 503);
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return reply({ error: "That request is too large." }, 413);

  const given = request.headers.get("x-family-password") ?? "";
  if (!(await passwordOk(given, env.FAMILY_PASSWORD))) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return reply({ error: "That password isn't right." }, 401);
  }

  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return reply({ error: "Bad request." }, 400);
  }

  try {
    switch (body.kind) {
      case "check":
        return reply({ ok: true });

      case "ask": {
        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .filter((m: Json) => (m.role === "user" || m.role === "assistant") && String(m.content ?? "").trim())
          .map((m: Json) => ({ role: m.role, content: String(m.content).trim().slice(0, MAX_TEXT) }));
        if (!messages.length) return reply({ error: "The question was empty." }, 400);
        if (messages[0].role !== "user") return reply({ error: "The first message must be from you." }, 400);
        const system = String(body.system ?? "").trim().slice(0, MAX_TEXT);
        const result = await withModels(async (model) => {
          const request: Json = { model, max_tokens: 4096, messages };
          if (system) request.system = system;
          const payload = await postAnthropic(env.ANTHROPIC_API_KEY as string, request);
          const text = (payload.content ?? [])
            .filter((item: Json) => item.type === "text")
            .map((item: Json) => item.text)
            .join("\n")
            .trim();
          if (!text) throw new Error("Claude did not return an answer.");
          return { text, model };
        });
        return reply(result);
      }

      default:
        return reply({ error: "Unknown request." }, 400);
    }
  } catch (err) {
    return reply({ error: err instanceof Error ? err.message : "Something went wrong." }, 502);
  }
}

export async function onRequest({ request }: Ctx): Promise<Response> {
  return reply({ error: "Use POST." }, request.method === "OPTIONS" ? 204 : 405);
}
