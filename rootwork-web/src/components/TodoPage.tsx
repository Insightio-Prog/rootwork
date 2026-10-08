import { useState, type FormEvent } from "react";
import { displayName, type Person } from "../data/people";
import { openTodoCount, type EvidenceTodo, type TodoPriority, type TreeTodos } from "../data/todos";

type TodoPageProps = {
  people: Record<string, Person>;
  todos: TreeTodos;
  onAddTodo: (input: { personId: string; title: string; detail: string; priority: TodoPriority }) => void;
  onRemoveTodo: (id: string) => void;
  onSetDone: (id: string, done: boolean) => void;
  onClearTodos: () => void;
  onOpenPerson: (id: string) => void;
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type Filter = "open" | "done" | "all";

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
      name: people[item.personId] ? displayName(people[item.personId]) : item.personId ? "Unknown person" : "General",
      items: [item],
    });
  }
  return groups;
}

export function TodoPage({
  people,
  todos,
  onAddTodo,
  onRemoveTodo,
  onSetDone,
  onClearTodos,
  onOpenPerson,
}: TodoPageProps) {
  const [filter, setFilter] = useState<Filter>("open");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [personId, setPersonId] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const openCount = openTodoCount(todos);
  const doneCount = todos.items.length - openCount;
  const visible = todos.items.filter((item) => {
    if (filter === "open") return !item.done;
    if (filter === "done") return item.done;
    return true;
  });
  const groups = groupByPerson(visible, people);
  const sortedPeople = Object.values(people).sort((a, b) =>
    displayName(a).localeCompare(displayName(b)),
  );

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onAddTodo({ personId, title, detail, priority });
    setTitle("");
    setDetail("");
    setFilter("open");
  }

  return (
    <section className="todo-page">
      <div className="todo-page-inner">
        <div className="todo-hero">
          <div>
            <div className="placeholder-kicker">Research</div>
            <h3>Research next</h3>
            <p>Your own checklist of things to find out. Tie each one to a person, or leave it general.</p>
          </div>
          <div className="todo-hero-actions">
            {todos.items.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (window.confirm("Clear the whole list?")) {
                    onClearTodos();
                    setFilter("open");
                  }
                }}
              >
                Clear list
              </button>
            )}
          </div>
        </div>

        <form className="card elev-md todo-add" onSubmit={handleAdd}>
          <input
            className="todo-add-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs finding out?"
            aria-label="To-do title"
          />
          <input
            className="todo-add-input"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Notes (optional)"
            aria-label="Notes"
          />
          <div className="todo-add-row">
            <select value={personId} onChange={(event) => setPersonId(event.target.value)} aria-label="Person">
              <option value="">General (no person)</option>
              {sortedPeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TodoPriority)}
              aria-label="Priority"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              Add
            </button>
          </div>
        </form>

        {todos.items.length > 0 && (
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

        {todos.items.length > 0 && visible.length === 0 && (
          <div className="card elev-md todo-empty">
            <p>
              {filter === "done"
                ? "Nothing ticked off yet."
                : filter === "open"
                  ? "Everything is ticked off. Nice work! Switch to Done to see them."
                  : "Nothing here."}
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
                  <button
                    type="button"
                    className="btn btn-ghost add-rel-btn"
                    onClick={() => onRemoveTodo(item.id)}
                    aria-label={`Delete ${item.title}`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
