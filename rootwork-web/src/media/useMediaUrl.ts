import { useEffect, useState } from "react";
import type { MediaRef } from "../data/people";
import { resolveMediaUrl } from "./store";

export function useMediaUrl(media: MediaRef | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!media) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void resolveMediaUrl(media).then((next) => {
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [media?.id, media?.ext, media?.mime]);

  return url;
}
