import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { idbGet, idbPut } from "../media/idb";
import { getWorkspaceIndex, storiesStorageKey, treeStorageKey } from "../state/workspaces";

const FORMAT = "rootwork.backup.v1";
const EMPTY_TREE =
  '{"treeTitle":"My Family","homePersonId":null,"people":{},"todos":{"items":[]}}';
const EMPTY_STORIES = '{"stories":{}}';
const MEDIA_RE = /^[A-Za-z0-9_-]{8,80}$/;
const ALLOWED_EXTS = [
  "jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "tif", "tiff", "pdf", "heic", "heif",
];
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff",
  pdf: "application/pdf", heic: "image/heic", heif: "image/heic",
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function extFromMime(mime: string): string {
  const hit = Object.entries(MIME_BY_EXT).find(([, value]) => value === mime);
  return hit ? hit[0] : "bin";
}

/** Media ids that a tree's JSON or stories JSON refer to. */
async function mediaForTree(treeJson: string, storiesJson: string) {
  const haystack = `${treeJson}${storiesJson}`;
  const found = new Map<string, { blob: Blob; mime: string }>();
  const ids = new Set(haystack.match(/[A-Za-z0-9_-]{8,80}/g) ?? []);
  for (const id of ids) {
    if (!haystack.includes(`"${id}"`)) continue;
    const stored = await idbGet(id).catch(() => undefined);
    if (stored) found.set(id, { blob: stored.blob, mime: stored.mime });
  }
  return found;
}

export async function makeBackupBlob(): Promise<Blob> {
  const treeJson = localStorage.getItem(treeStorageKey()) ?? EMPTY_TREE;
  const storiesJson = localStorage.getItem(storiesStorageKey()) ?? EMPTY_STORIES;
  const files: Zippable = {
    "manifest.json": strToU8(JSON.stringify({ format: FORMAT, exportedAt: new Date().toISOString() })),
    "tree.json": strToU8(treeJson),
    "stories.json": strToU8(storiesJson),
  };
  for (const [id, item] of await mediaForTree(treeJson, storiesJson)) {
    const ext = extFromMime(item.mime);
    files[`media/${id}.${ext}`] = [new Uint8Array(await item.blob.arrayBuffer()), { level: 0 }];
  }
  return new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: "application/zip" });
}

/** Writes a backup file into the current tree. Caller reloads tree and stories after. */
export async function restoreBackup(file: File): Promise<void> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("That file is not a Rootwork backup.");
  }
  const manifestRaw = entries["manifest.json"];
  let format = "";
  try {
    format = manifestRaw ? String(JSON.parse(strFromU8(manifestRaw)).format ?? "") : "";
  } catch {
    // fall through
  }
  if (format !== FORMAT) throw new Error("That file is not a Rootwork backup.");
  const treeRaw = entries["tree.json"];
  if (!treeRaw) throw new Error("This backup is missing the family tree.");
  const tree = strFromU8(treeRaw);
  JSON.parse(tree);
  const stories = entries["stories.json"] ? strFromU8(entries["stories.json"]) : EMPTY_STORIES;

  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.startsWith("media/")) continue;
    if (name.includes("..")) throw new Error("Invalid backup file.");
    const base = name.slice("media/".length);
    const dot = base.lastIndexOf(".");
    if (dot < 1) continue;
    const id = base.slice(0, dot);
    const ext = base.slice(dot + 1).toLowerCase();
    if (!MEDIA_RE.test(id) || !ALLOWED_EXTS.includes(ext)) continue;
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    await idbPut(id, mime, new Blob([bytes as BlobPart], { type: mime }));
  }
  localStorage.setItem(treeStorageKey(), tree);
  localStorage.setItem(storiesStorageKey(), stories);
}

export async function readGedcomFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decode = (data: Uint8Array) => strFromU8(data).replace(/^﻿/, "");
  if (file.name.toLowerCase().endsWith(".zip") || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new Error("Could not open that zip file.");
    }
    const name = Object.keys(entries).find((key) => key.toLowerCase().endsWith(".ged") && !key.includes(".."));
    if (!name) throw new Error("No GEDCOM file in this zip.");
    return decode(entries[name]);
  }
  return decode(bytes);
}

// ---- HTML export (one shareable read-only file) ----

const MAX_EDGE = 1600;

async function packMedia(blob: Blob, mime: string): Promise<{ mime: string; data: string }> {
  let out = blob;
  let outMime = mime;
  if (mime.startsWith("image/") && mime !== "image/gif") {
    try {
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
        if (jpeg) {
          out = jpeg;
          outMime = "image/jpeg";
        }
      }
      bitmap.close();
    } catch {
      // keep the original bytes
    }
  }
  const bytes = new Uint8Array(await out.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { mime: outMime, data: btoa(binary) };
}

export async function makeViewerHtml(charts: Record<string, unknown>): Promise<Blob> {
  const response = await fetch("/viewer.template.html");
  if (!response.ok) throw new Error("The view-only template is missing from this site.");
  const template = await response.text();
  const trees = [];
  for (const entry of getWorkspaceIndex().trees) {
    const treeJson = localStorage.getItem(treeStorageKey(entry.id)) ?? EMPTY_TREE;
    const storiesJson = localStorage.getItem(storiesStorageKey(entry.id)) ?? EMPTY_STORIES;
    const media: Record<string, { mime: string; data: string }> = {};
    for (const [id, item] of await mediaForTree(treeJson, storiesJson)) {
      media[id] = await packMedia(item.blob, item.mime);
    }
    let stories: unknown = {};
    try {
      stories = (JSON.parse(storiesJson) as { stories?: unknown }).stories ?? {};
    } catch {
      // empty stories
    }
    trees.push({
      id: entry.id,
      name: entry.name,
      tree: JSON.parse(treeJson),
      stories,
      chart: charts[entry.id] ?? null,
      media,
    });
  }
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), trees }).replace(/</g, "\\u003c");
  const block = `<script type="application/json" id="rootwork-export">${payload}</script>`;
  const html = template.includes("<!--ROOTWORK_EXPORT-->")
    ? template.replace("<!--ROOTWORK_EXPORT-->", () => block)
    : template.replace("</body>", () => `${block}</body>`);
  return new Blob([html], { type: "text/html" });
}
