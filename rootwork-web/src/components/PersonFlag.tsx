import { useState } from "react";
import { flagCodeFor, flagUrl } from "../data/countries";
import type { MediaRef } from "../data/people";
import { isImageMedia } from "../media/store";
import { useMediaUrl } from "../media/useMediaUrl";

type PersonFlagProps = {
  flag: MediaRef | null;
  nationality?: string;
  className?: string;
  layoutId?: string;
};

/** A picture the person added wins; otherwise the flag of their nationality, when we have one. */
export function PersonFlag({ flag, nationality, className = "", layoutId }: PersonFlagProps) {
  const url = useMediaUrl(flag);
  const [missing, setMissing] = useState<string | null>(null);
  const custom = Boolean(url && isImageMedia(flag));
  const code = flagCodeFor(nationality);
  const countryFlag = !custom && code && missing !== code ? flagUrl(code) : null;
  const show = custom || Boolean(countryFlag);

  return (
    <div
      className={`person-flag${show ? " has-flag" : ""}${className ? ` ${className}` : ""}`}
      data-layout={layoutId}
      title={!custom && countryFlag ? nationality : undefined}
    >
      {custom ? <img src={url ?? ""} alt="" className="media-cover" /> : null}
      {countryFlag ? (
        <img src={countryFlag} alt={nationality ?? ""} className="media-cover" onError={() => setMissing(code)} />
      ) : null}
    </div>
  );
}
