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
