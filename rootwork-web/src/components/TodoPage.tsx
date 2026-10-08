import { useState } from "react";
import { displayName, type Person } from "../data/people";
import { openTodoCount, type EvidenceTodo, type TodoPriority, type TreeTodos } from "../data/todos";
import { hasApiKey, invokeErrorMessage, suggestTreeTodos } from "../review/claude";
import { buildTreeTodoBrief } from "../review/treeTodos";

type TodoPageProps = {
  people: Record<string, Person>;
  todos: TreeTodos;
  onReplaceTodos: (todos: TreeTodos) => void;
  onSetDone: (id: string, done: boolean) => void;
  onClearTodos: () => void;
  onOpenPerson: (id: string) => void;
  onNeedApiKey: () => void;
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type Filter = "open" | "done" | "all";

function formatGeneratedAt(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function groupByPerson(items: EvidenceTodo[], people: Record<string, Person>) {
  const groups: { personId: string; name: string; items: EvidenceTodo[] }[] = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const existing = index.get(item.personId);
    if (existing != null) {
      groups[existing].items.push(item);
      continue;
    }
    index.set(item.personId, groups.length);
    groups.push({
      personId: item.personId,
      name: people[item.personId] ? displayName(people[item.personId]) : "Unknown person",
      items: [item],
    });
  }
  return groups;
}

export function TodoPage({
  people,
  todos,
  onReplaceTodos,
  onSetDone,
  onClearTodos,
  onOpenPerson,
  onNeedApiKey,
}: TodoPageProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const personCount = Object.keys(people).length;
  const openCount = openTodoCount(todos);
  const doneCount = todos.items.length - openCount;
  const visible = todos.items.filter((item) => {
    if (filter === "open") return !item.done;
    if (filter === "done") return item.done;
    return true;
  });
  const groups = groupByPerson(visible, people);
  const scanned = Boolean(todos.generatedAt);

  async function handleScan() {
    if (busy) return;
    setError("");
    if (personCount === 0) {
      setError("Add people to the tree first.");
      return;
    }
    setBusy(true);
    try {
      const ready = await hasApiKey();
      if (!ready) {
        onNeedApiKey();
        return;
      }
      const next = await suggestTreeTodos(buildTreeTodoBrief(people));
      onReplaceTodos(next);
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="todo-page">
      <div className="todo-page-inner">
        <div className="todo-hero">
          <div>
            <div className="placeholder-kicker">Research</div>
            <h3>Research next</h3>
            <p>
              Claude reads a brief of the whole tree — names, dates, places, and family links — then
              lists gaps worth filling in next.
            </p>
          </div>
          <div className="todo-hero-actions">
            {scanned && todos.items.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClearTodos();
                  setFilter("open");
                  setError("");
                }}
                disabled={busy}
              >
                Clear list
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleScan()}
              disabled={busy || personCount === 0}
            >
              {busy ? "Scanning…" : scanned ? "Scan again" : "Scan tree"}
            </button>
          </div>
        </div>

        {scanned && (
          <p className="todo-meta">
            {formatGeneratedAt(todos.generatedAt)}
            {todos.model ? ` · ${todos.model}` : ""}
            {` · ${personCount} ${personCount === 1 ? "person" : "people"}`}
            {` · ${openCount} open, ${doneCount} done`}
          </p>
        )}
        {todos.summary && <p className="todo-summary">{todos.summary}</p>}
        {error && <p className="dialog-error">{error}</p>}

        {scanned && todos.items.length > 0 && (
          <div className="todo-filters" role="tablist" aria-label="To-do filter">
            {(
              [
                ["open", `Open (${openCount})`],
                ["done", `Done (${doneCount})`],
                ["all", `All (${todos.items.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`todo-filter ${filter === id ? "is-active" : ""}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {!scanned && !busy && (
          <div className="card elev-md todo-empty">
            <p>
              Scan the tree to build a checklist. Ticked items stay ticked when you scan again, so
              you can keep a running research list.
            </p>
          </div>
        )}

        {scanned && visible.length === 0 && (
          <div className="card elev-md todo-empty">
            <p>
              {filter === "done"
                ? "Nothing ticked off yet."
                : filter === "open"
                  ? doneCount > 0
                    ? "Everything on this list is ticked off, so Open is empty. Switch to Done to see them, or clear the list and scan again for a fresh checklist."
                    : personCount > 0
                      ? "Nothing left open. Scan again after you add facts, or clear the list to start over."
                      : "Add people to the tree, then scan again."
                  : "Claude did not find anything to collect right now."}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.personId} className="todo-group">
            <div className="todo-group-head">
              <span className="parents-kicker">{group.name}</span>
              {people[group.personId] && (
                <button
                  type="button"
                  className="btn btn-ghost add-rel-btn"
                  onClick={() => onOpenPerson(group.personId)}
                >
                  Open person
                </button>
              )}
            </div>
            <ul className="todo-list">
              {group.items.map((item) => (
                <li key={item.id} className={`todo-item ${item.done ? "is-done" : ""}`}>
                  <label className="todo-row">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(event) => onSetDone(item.id, event.target.checked)}
                    />
                    <span className="todo-copy">
                      <span className="todo-title-row">
                        <span className="todo-title">{item.title}</span>
                        <span className={`todo-priority is-${item.priority}`}>
                          {PRIORITY_LABEL[item.priority]}
                        </span>
                      </span>
                      {item.detail && <span className="todo-detail">{item.detail}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
