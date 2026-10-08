import { storedPassword } from "../review/claude";

export type ShareStatus = { shared: false } | { shared: true; token: string; size: number; updatedAt: string };

const PIECE = 4 * 1024 * 1024;

export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}

async function call<T>(query: string, body?: BodyInit): Promise<T> {
  const password = storedPassword();
  if (!password) throw new Error("Unlock with the family password first.");
  let response: Response;
  try {
    response = await fetch(`/api/share?${query}`, {
      method: "POST",
      headers: { "x-family-password": password },
      body,
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? `The server said no (${response.status}).`);
  return payload;
}

export function shareStatus(): Promise<ShareStatus> {
  return call<ShareStatus>("action=status");
}

/** Uploads the family backup in pieces, then switches the link over to it. */
export async function publishShare(
  page: Blob,
  rotate: boolean,
  onProgress: (done: number, total: number) => void,
): Promise<ShareStatus> {
  const { upload } = await call<{ upload: string }>("action=start");
  const total = Math.max(1, Math.ceil(page.size / PIECE));
  for (let index = 0; index < total; index++) {
    onProgress(index, total);
    await call(`action=chunk&upload=${encodeURIComponent(upload)}&i=${index}`, page.slice(index * PIECE, (index + 1) * PIECE));
  }
  onProgress(total, total);
  return call<ShareStatus>(
    `action=finish&upload=${encodeURIComponent(upload)}&count=${total}&size=${page.size}&kind=zip${rotate ? "&rotate=1" : ""}`,
  );
}

export function stopShare(): Promise<ShareStatus> {
  return call<ShareStatus>("action=stop");
}
