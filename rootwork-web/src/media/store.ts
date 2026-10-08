import type { MediaRef } from "../data/people";
import { idbDelete, idbGet, idbPut } from "./idb";

const urlCache = new Map<string, string>();
let exportMedia: Record<string, { mime: string; data: string }> | null = null;

export function isImageMedia(media: MediaRef | null | undefined): boolean {
  if (!media) return false;
  if (media.mime.startsWith("image/")) return true;
  return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".tif", ".tiff", ".heic", ".heif"].includes(
    media.ext,
  );
}

export function extFromFile(file: File): string {
  const fromName = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".") + 1) : "";
  const raw = (fromName || mimeExt(file.type) || "bin").toLowerCase();
  return raw.replace(/[^a-z0-9]/g, "") || "bin";
}

function mimeExt(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/tiff") return "tiff";
  return "";
}

export async function importMedia(file: File): Promise<MediaRef> {
  const id = crypto.randomUUID();
  const ext = extFromFile(file);
  const mime = file.type || "application/octet-stream";
  await idbPut(id, mime, file);
  return { id, originalName: file.name, mime, ext: `.${ext}` };
}

export async function importMediaFiles(files: File[]): Promise<MediaRef[]> {
  const media: MediaRef[] = [];
  for (const file of files) {
    media.push(await importMedia(file));
  }
  return media;
}

export function setExportMedia(map: Record<string, { mime: string; data: string }> | null) {
  clearMediaUrlCache();
  exportMedia = map;
}

export async function resolveMediaUrl(media: MediaRef): Promise<string | null> {
  if (exportMedia) {
    const item = exportMedia[media.id];
    if (!item?.data) return null;
    const cached = urlCache.get(media.id);
    if (cached) return cached;
    const url = `data:${item.mime || "application/octet-stream"};base64,${item.data}`;
    urlCache.set(media.id, url);
    return url;
  }
  const cached = urlCache.get(media.id);
  if (cached) return cached;
  try {
    const stored = await idbGet(media.id);
    if (!stored) return null;
    const url = URL.createObjectURL(stored.blob);
    urlCache.set(media.id, url);
    return url;
  } catch {
    return null;
  }
}

export async function deleteMedia(media: MediaRef): Promise<void> {
  const cached = urlCache.get(media.id);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(media.id);
  }
  try {
    await idbDelete(media.id);
  } catch {
    // Missing files should not block deleting a person.
  }
}

export function clearMediaUrlCache() {
  urlCache.forEach((url) => URL.revokeObjectURL(url));
  urlCache.clear();
}
