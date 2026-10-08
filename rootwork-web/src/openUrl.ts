import { normalizeEvidenceUrl } from "./data/people";

export async function openExternalUrl(url: string): Promise<void> {
  const safe = normalizeEvidenceUrl(url);
  if (!safe) return;
  window.open(safe, "_blank", "noopener,noreferrer");
}
