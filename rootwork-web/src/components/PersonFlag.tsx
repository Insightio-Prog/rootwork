import { useState } from "react";
import { countryNameFor, flagCodeFor, flagCodeFromPlace, flagUrl } from "../data/countries";
import type { MediaRef } from "../data/people";
import { isImageMedia } from "../media/store";
import { useMediaUrl } from "../media/useMediaUrl";

type PersonFlagProps = {
  flag: MediaRef | null;
  nationality?: string;
  birthPlace?: string;
  className?: string;
  layoutId?: string;
};

/** A picture the person added wins; otherwise the flag of their nationality, when we have one. */
export function PersonFlag({ flag, nationality, birthPlace, className = "", layoutId }: PersonFlagProps) {
  const url = useMediaUrl(flag);
  const [missing, setMissing] = useState<string | null>(null);
  const custom = Boolean(url && isImageMedia(flag));
  const ownCode = flagCodeFor(nationality);
  const derived = !ownCode;
  const code = ownCode ?? flagCodeFromPlace(birthPlace);
  const countryFlag = !custom && code && missing !== code ? flagUrl(code) : null;
  const show = custom || Boolean(countryFlag);

  return (
    <div
      className={`person-flag${show ? " has-flag" : ""}${!custom && derived && countryFlag ? " is-derived" : ""}${className ? ` ${className}` : ""}`}
      data-layout={layoutId}
      title={
        !custom && countryFlag
          ? derived
            ? `Born in ${countryNameFor(code)} (from birthplace)`
            : nationality
          : undefined
      }
    >
      {custom ? <img src={url ?? ""} alt="" className="media-cover" /> : null}
      {countryFlag ? (
        <img src={countryFlag} alt={nationality || countryNameFor(code)} className="media-cover" onError={() => setMissing(code)} />
      ) : null}
    </div>
  );
}
