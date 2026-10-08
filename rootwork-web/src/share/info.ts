export type ShareInfo = { updatedAt: string; size: number; data: string };

/** Set by the server when the app is opened from a family link (/s/<token>). */
export function shareInfo(): ShareInfo | null {
  const value = (window as unknown as { __ROOTWORK_SHARE?: ShareInfo }).__ROOTWORK_SHARE;
  return value && typeof value.data === "string" ? value : null;
}

/** True when this copy of the app was opened from a family link: no maps, no publishing. */
export const isSharedCopy = shareInfo() !== null;

/** An earlier build offered a "full version" switch on phones; clear it so nobody stays stuck on it. */
try {
  localStorage.removeItem("rootwork.fullLayout");
} catch {
  /* ignore */
}
