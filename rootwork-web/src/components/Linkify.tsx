import { Fragment } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

function shortLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return /findmypast/i.test(host) ? "Findmypast record" : host;
  } catch {
    return "Link";
  }
}

/** Plain text in which any web address becomes a short, clickable link. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, index) => {
        if (!/^https?:\/\//.test(part)) return <Fragment key={index}>{part}</Fragment>;
        const trailing = part.match(/[.,;:!?)]+$/)?.[0] ?? "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        const href = url.replace(/^http:\/\/(search\.findmypast)/, "https://$1");
        return (
          <Fragment key={index}>
            <a className="source-link" href={href} target="_blank" rel="noopener noreferrer" title={url}>
              {shortLabel(url)} ↗
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
}
