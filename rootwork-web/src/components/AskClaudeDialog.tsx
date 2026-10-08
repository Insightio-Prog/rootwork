import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { displayName, type Person } from "../data/people";
import { askAboutTree, hasApiKey, invokeErrorMessage, type ChatTurn } from "../review/claude";
import { buildTreeAskBrief } from "../review/treeAsk";
import { MarkdownText } from "../stories/render";

type AskClaudeDialogProps = {
  treeTitle: string;
  people: Record<string, Person>;
  homePersonId: string | null;
  selectedPersonId: string | null;
  messages: ChatTurn[];
  onMessages: (messages: ChatTurn[]) => void;
  onClose: () => void;
  onNeedApiKey: () => void;
};

export function AskClaudeDialog({
  treeTitle,
  people,
  homePersonId,
  selectedPersonId,
  messages,
  onMessages,
  onClose,
  onNeedApiKey,
}: AskClaudeDialogProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const personCount = Object.keys(people).length;
  const selected = selectedPersonId ? people[selectedPersonId] : undefined;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const host = threadRef.current;
    if (!host) return;
    host.scrollTop = host.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError("");
    if (personCount === 0) {
      setError("Add people to the tree first.");
      return;
    }
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: question }];
    onMessages(nextMessages);
    setDraft("");
    setBusy(true);
    try {
      const ready = await hasApiKey();
      if (!ready) {
        onNeedApiKey();
        onMessages(messages);
        setDraft(question);
        return;
      }
      const reply = await askAboutTree({
        system: buildTreeAskBrief({
          treeTitle,
          people,
          homePersonId,
          selectedPersonId,
        }),
        messages: nextMessages,
      });
      onMessages([...nextMessages, { role: "assistant", content: reply.text }]);
    } catch (err) {
      onMessages(messages);
      if (aliveRef.current) {
        setDraft(question);
        setError(invokeErrorMessage(err));
      }
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void send(draft);
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <div
        className="dialog ask-claude-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-claude-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ask-claude-head">
          <div>
            <div className="dialog-title" id="ask-claude-title">
              Ask Claude
            </div>
            <p className="dialog-body">
              {selected
                ? `Questions can use anyone in ${treeTitle || "this tree"}. Selected now: ${displayName(selected)}.`
                : `Ask about people, dates, and relationships in ${treeTitle || "this tree"}.`}
            </p>
          </div>
          <div className="ask-claude-head-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || messages.length === 0}
              onClick={() => {
                setError("");
                onMessages([]);
              }}
            >
              New chat
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div ref={threadRef} className="ask-claude-thread">
          {messages.length === 0 && !busy ? (
            <p className="ask-claude-empty">
              Try “Who are the parents of the home person?” or “Who was born before 1900?”
            </p>
          ) : null}
          {messages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`ask-claude-msg is-${item.role}`}>
              <span className="ask-claude-msg-label">{item.role === "user" ? "You" : "Claude"}</span>
              {item.role === "assistant" ? (
                <div className="ask-claude-prose">
                  <MarkdownText text={item.content} />
                </div>
              ) : (
                <p>{item.content}</p>
              )}
            </div>
          ))}
          {busy ? <p className="ask-claude-pending">Claude is reading the tree…</p> : null}
        </div>
        {error ? <p className="dialog-error">{error}</p> : null}
        <form className="ask-claude-compose" onSubmit={handleSubmit}>
          <textarea
            id="ask-claude-input"
            className="input"
            rows={3}
            value={draft}
            disabled={busy}
            aria-label="Question"
            placeholder="Ask a question about this tree"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
              {busy ? "Asking…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
