let lastFire = 0;

/** True for a moment after a long-press has fired, so the tap that ends it isn't also treated as a click. */
export function longPressJustFired(): boolean {
  return Date.now() - lastFire < 700;
}

/**
 * Touch screens (iPads especially) have no right-click, so holding a finger still on something does the same
 * job. Mouse input is ignored. Moving the finger or letting go cancels it.
 */
export function startLongPress(
  event: { pointerType: string; clientX: number; clientY: number },
  onLongPress: (x: number, y: number) => void,
  ms = 550,
): void {
  if (event.pointerType === "mouse") return;
  const startX = event.clientX;
  const startY = event.clientY;
  let timer = 0;
  const cancel = () => {
    window.clearTimeout(timer);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", cancel);
    window.removeEventListener("pointercancel", cancel);
  };
  const move = (next: PointerEvent) => {
    if (Math.hypot(next.clientX - startX, next.clientY - startY) > 10) cancel();
  };
  timer = window.setTimeout(() => {
    cancel();
    lastFire = Date.now();
    onLongPress(startX, startY);
  }, ms);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", cancel);
  window.addEventListener("pointercancel", cancel);
}
