import type { MediaRef } from "../data/people";
import { isImageMedia } from "../media/store";
import { useMediaUrl } from "../media/useMediaUrl";

type PersonFlagProps = {
  flag: MediaRef | null;
  className?: string;
  layoutId?: string;
};

export function PersonFlag({ flag, className = "", layoutId }: PersonFlagProps) {
  const url = useMediaUrl(flag);
  const show = Boolean(url && isImageMedia(flag));

  return (
    <div
      className={`person-flag${show ? " has-flag" : ""}${className ? ` ${className}` : ""}`}
      data-layout={layoutId}
    >
      {show ? <img src={url ?? ""} alt="" className="media-cover" /> : null}
    </div>
  );
}
