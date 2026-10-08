export type ShareInfo = { updatedAt: string; size: number; data: string };

/** Set by the server when the app is opened from a family link (/s/<token>). */
export function shareInfo(): ShareInfo | null {
  const value = (window as unknown as { __ROOTWORK_SHARE?: ShareInfo }).__ROOTWORK_SHARE;
  return value && typeof value.data === "string" ? value : null;
}

/** True when this copy of the app was opened from a family link: no maps, no publishing. */
export const isSharedCopy = shareInfo() !== null;

const FULL_KEY = "rootwork.fullLayout";

export function fullLayoutOn(): boolean {
  try {
    return localStorage.getItem(FULL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFullLayout(on: boolean) {
  try {
    if (on) localStorage.setItem(FULL_KEY, "1");
    else localStorage.removeItem(FULL_KEY);
  } catch {
    /* private window: just won't be remembered */
  }
}

/** On a phone, asks the browser for a wide page so the full desktop layout shows. */
export function applyFullLayout() {
  if (!fullLayoutOn()) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) meta.setAttribute("content", "width=1100, initial-scale=1.0");
}
