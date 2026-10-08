import type { EvidenceReview, FactReview, FactVerdict } from "../data/people";
import type { TreeTodos } from "../data/todos";
import { idbGet } from "../media/idb";
import type { PersonDossier } from "./dossier";

const VERDICTS = new Set<FactVerdict>(["supported", "weak", "missing", "conflict"]);

type RawReview = {
  summary?: string;
  model?: string;
  facts?: Array<{ id?: string; verdict?: string; note?: string }>;
};

const PASSWORD_KEY = "rootwork.ai.password";

function storedPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? "";
  } catch {
    return "";
  }
}

async function callClaude<T>(body: Record<string, unknown>, password = storedPassword()): Promise<T> {
  if (!password) throw new Error("Unlock Claude with the family password first (Settings).");
  let response: Response;
  try {
    response = await fetch("/api/claude", {
      method: "POST",
      headers: { "content-type": "application/json", "x-family-password": password },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach Claude. Check your connection and try again.");
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? `Claude request failed (${response.status}).`);
  return payload;
}

export async function hasApiKey(): Promise<boolean> {
  return Boolean(storedPassword());
}

/** Checks the family password with the server, then remembers it in this browser. */
export async function saveApiKey(password: string): Promise<void> {
  const trimmed = password.trim();
  await callClaude({ kind: "check" }, trimmed);
  localStorage.setItem(PASSWORD_KEY, trimmed);
}

export async function clearApiKey(): Promise<void> {
  localStorage.removeItem(PASSWORD_KEY);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function reviewPersonEvidence(dossier: PersonDossier): Promise<EvidenceReview> {
  const files = [];
  for (const file of dossier.files) {
    const stored = await idbGet(file.id).catch(() => undefined);
    files.push({
      name: file.name,
      label: file.label,
      mime: file.mime,
      ext: file.ext,
      data: stored ? await blobToBase64(stored.blob) : "",
    });
  }
  const raw = await callClaude<RawReview>({ kind: "review", text: dossier.text, files });
  const facts: FactReview[] = Array.isArray(raw.facts)
    ? raw.facts
        .filter((fact) => fact && typeof fact.id === "string" && fact.id.trim())
        .map((fact) => ({
          id: String(fact.id).trim(),
          verdict: VERDICTS.has(fact.verdict as FactVerdict)
            ? (fact.verdict as FactVerdict)
            : "missing",
          note: String(fact.note ?? "").trim(),
        }))
    : [];
  return {
    reviewedAt: new Date().toISOString(),
    model: String(raw.model ?? "").trim(),
    summary: String(raw.summary ?? "").trim(),
    facts,
  };
}

type RawTodoItem = {
  id?: string;
  personId?: string;
  person_id?: string;
  person?: string;
  title?: string;
  name?: string;
  task?: string;
  detail?: string;
  note?: string;
  description?: string;
  priority?: string;
};

type RawTodos = {
  summary?: string;
  model?: string;
  items?: RawTodoItem[];
  todos?: RawTodoItem[];
  tasks?: RawTodoItem[];
};

function asTodoRows(raw: RawTodos): RawTodoItem[] {
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.todos)) return raw.todos;
  if (Array.isArray(raw.tasks)) return raw.tasks;
  return [];
}

export async function suggestTreeTodos(text: string): Promise<TreeTodos> {
  const raw = await callClaude<RawTodos>({ kind: "todos", text });
  return {
    generatedAt: new Date().toISOString(),
    model: String(raw.model ?? "").trim(),
    summary: String(raw.summary ?? "").trim(),
    items: asTodoRows(raw).map((item) => ({
      id: String(item.id ?? "").trim(),
      personId: String(item.personId ?? item.person_id ?? item.person ?? "").trim(),
      title: String(item.title ?? item.name ?? item.task ?? "").trim(),
      detail: String(item.detail ?? item.note ?? item.description ?? "").trim(),
      priority: item.priority === "high" || item.priority === "low" ? item.priority : "medium",
      done: false,
      doneAt: "",
    })),
  };
}

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export async function askAboutTree(input: {
  system: string;
  messages: ChatTurn[];
}): Promise<{ text: string; model: string }> {
  const raw = await callClaude<{ text?: string; model?: string }>({
    kind: "ask",
    system: input.system,
    messages: input.messages,
  });
  const text = String(raw.text ?? "").trim();
  if (!text) throw new Error("Claude did not return an answer.");
  return { text, model: String(raw.model ?? "").trim() };
}

export function invokeErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
