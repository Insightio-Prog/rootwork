// Cloudflare Pages Function: POST /api/claude
// Holds the Anthropic key server-side and only answers people who know the family password.
// Secrets (set in the Cloudflare dashboard, never in the repo):
//   ANTHROPIC_API_KEY  - your Anthropic key
//   FAMILY_PASSWORD    - the password you give family to unlock Claude

type Env = { ANTHROPIC_API_KEY?: string; FAMILY_PASSWORD?: string };
type Ctx = { request: Request; env: Env };
type Json = Record<string, any>;

const MODELS = ["claude-sonnet-5-5", "claude-sonnet-5", "claude-sonnet-4-6"];
const MAX_FILES = 12;
const MAX_FILE_B64 = 7 * 1024 * 1024; // ~5 MB of file per attachment
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

const REVIEW_TOOL = {
  name: "submit_review",
  max_tokens: 1600,
  tools: [
    {
      name: "submit_review",
      description: "Record whether each genealogical fact is supported by the attached evidence.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          facts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                verdict: { type: "string", enum: ["supported", "weak", "missing", "conflict"] },
                note: { type: "string" },
              },
              required: ["id", "verdict", "note"],
            },
          },
        },
        required: ["summary", "facts"],
      },
    },
  ],
};

const TODOS_TOOL = {
  name: "submit_todos",
  max_tokens: 4096,
  tools: [
    {
      name: "submit_todos",
      description: "List missing genealogical evidence to collect next.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                personId: { type: "string" },
                title: { type: "string" },
                detail: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["id", "personId", "title", "detail", "priority"],
            },
          },
        },
        required: ["summary", "items"],
      },
    },
  ],
};

function imageMime(mime: string, ext: string) {
  const e = ext.replace(/^\./, "").toLowerCase();
  if (mime === "image/png" || e === "png") return "image/png";
  if (mime === "image/gif" || e === "gif") return "image/gif";
  if (mime === "image/webp" || e === "webp") return "image/webp";
  return "image/jpeg";
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

function normalizeTodos(input: Json): Json {
  if (!Array.isArray(input.items)) {
    const alt = input.todos ?? input.tasks;
    if (alt) input.items = alt;
  }
  if (Array.isArray(input.items)) {
    for (const item of input.items) {
      const fill = (target: string, keys: string[]) => {
        if (typeof item[target] === "string" && item[target]) return;
        for (const key of keys) {
          if (item[key] != null) {
            item[target] = item[key];
            return;
          }
        }
      };
      fill("personId", ["person_id", "person", "subjectId", "subject_id"]);
      fill("title", ["name", "task"]);
      fill("detail", ["note", "description", "reason"]);
    }
  }
  return input;
}

async function callTool(key: string, content: Json[], tool: typeof REVIEW_TOOL, isTodos: boolean) {
  return withModels(async (model) => {
    const payload = await postAnthropic(key, {
      model,
      max_tokens: tool.max_tokens,
      tool_choice: { type: "tool", name: tool.name },
      tools: tool.tools,
      messages: [{ role: "user", content }],
    });
    const block = (payload.content ?? []).find((item: Json) => item.type === "tool_use");
    if (!block?.input) throw new Error("Claude did not return a result.");
    let input = block.input as Json;
    if (isTodos) input = normalizeTodos(input);
    input.model = model;
    return input;
  });
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

      case "review": {
        const content: Json[] = [];
        const skipped: string[] = [];
        const files: Json[] = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
        for (const file of files) {
          const name = String(file.name ?? "file");
          const data = typeof file.data === "string" ? file.data : "";
          const ext = String(file.ext ?? "").replace(/^\./, "").toLowerCase();
          const mime = String(file.mime ?? "");
          if (!data) {
            skipped.push(`${name} could not be read`);
            continue;
          }
          if (data.length > MAX_FILE_B64) {
            skipped.push(`${name} is too large to send`);
            continue;
          }
          if (mime === "application/pdf" || ext === "pdf") {
            content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
          } else if (
            ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime) ||
            ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
          ) {
            content.push({ type: "image", source: { type: "base64", media_type: imageMime(mime, ext), data } });
          } else {
            skipped.push(`${name} is not a JPEG, PNG, GIF, WebP, or PDF`);
            continue;
          }
          content.push({ type: "text", text: `The previous file is: ${String(file.label ?? name)}` });
        }
        let text = String(body.text ?? "").slice(0, MAX_TEXT);
        if (skipped.length) text += `\n\nFiles not sent:\n- ${skipped.join("\n- ")}`;
        content.push({ type: "text", text });
        return reply(await callTool(env.ANTHROPIC_API_KEY, content, REVIEW_TOOL, false));
      }

      case "todos": {
        const text = String(body.text ?? "").trim().slice(0, MAX_TEXT);
        if (!text) return reply({ error: "The tree brief was empty." }, 400);
        return reply(await callTool(env.ANTHROPIC_API_KEY, [{ type: "text", text }], TODOS_TOOL, true));
      }

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
