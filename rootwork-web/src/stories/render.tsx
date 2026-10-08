import { Fragment, type ReactNode } from "react";

export function splitMarkdownBlocks(markdown: string): { type: "md"; text: string }[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ type: "md" as const, text }));
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[1];
    if (token.startsWith("**")) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    key += 1;
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      nodes.push(
        <Tag key={key}>{renderInline(heading[2])}</Tag>,
      );
      key += 1;
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(
          <li key={key}>{renderInline(lines[index].replace(/^[-*]\s+/, ""))}</li>,
        );
        key += 1;
        index += 1;
      }
      nodes.push(<ul key={key}>{items}</ul>);
      key += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(
          <li key={key}>{renderInline(lines[index].replace(/^\d+\.\s+/, ""))}</li>,
        );
        key += 1;
        index += 1;
      }
      nodes.push(<ol key={key}>{items}</ol>);
      key += 1;
      continue;
    }

    const para: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      para.push(lines[index]);
      index += 1;
    }
    if (para.length) {
      nodes.push(<p key={key}>{renderInline(para.join(" "))}</p>);
      key += 1;
    } else {
      index += 1;
    }
  }

  return <Fragment>{nodes}</Fragment>;
}
