import { useEffect, useState } from "react";

/** Below this width the app shows the simple, view-only phone layout. Tablets in landscape keep the full app. */
export const PHONE_QUERY = "(max-width: 899px)";

export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(PHONE_QUERY).matches));
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}
