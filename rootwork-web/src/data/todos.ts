
export type TodoPriority = "high" | "medium" | "low";

export type EvidenceTodo = {
  id: string;
  personId: string;
  title: string;
  detail: string;
  priority: TodoPriority;
  done: boolean;
  doneAt: string;
};

export type TreeTodos = {
  generatedAt: string;
  model: string;
  summary: string;
  items: EvidenceTodo[];
};

const PRIORITIES = new Set<TodoPriority>(["high", "medium", "low"]);

export const EMPTY_TODOS: TreeTodos = {
  generatedAt: "",
  model: "",
  summary: "",
  items: [],
};

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function normalizeTreeTodos(value: unknown): TreeTodos {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_TODOS;
  const raw = value as Partial<TreeTodos>;
  const items = Array.isArray(raw.items)
    ? raw.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<EvidenceTodo>;
        const personId = typeof row.personId === "string" ? row.personId.trim() : "";
        const title = typeof row.title === "string" ? row.title.trim() : "";
        if (!title) return [];
        const id =
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim()
            : `${personId}:${slugPart(title) || "item"}`;
        const priority = PRIORITIES.has(row.priority as TodoPriority)
          ? (row.priority as TodoPriority)
          : "medium";
        return [
          {
            id,
            personId,
            title,
            detail: typeof row.detail === "string" ? row.detail.trim() : "",
            priority,
            done: Boolean(row.done),
            doneAt: typeof row.doneAt === "string" ? row.doneAt : "",
          },
        ];
      })
    : [];
  return {
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    model: typeof raw.model === "string" ? raw.model : "",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    items: dedupeTodos(items),
  };
}

function dedupeTodos(items: EvidenceTodo[]): EvidenceTodo[] {
  const seen = new Set<string>();
  const next: EvidenceTodo[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

export function addTodoItem(
  todos: TreeTodos,
  input: { personId: string; title: string; detail: string; priority: TodoPriority },
): TreeTodos {
  const title = input.title.trim();
  if (!title) return todos;
  const base = `${input.personId || "general"}:${slugPart(title) || "item"}`;
  let id = base;
  for (let n = 2; todos.items.some((item) => item.id === id); n++) id = `${base}-${n}`;
  const item: EvidenceTodo = {
    id,
    personId: input.personId,
    title,
    detail: input.detail.trim(),
    priority: input.priority,
    done: false,
    doneAt: "",
  };
  return { ...todos, items: [item, ...todos.items] };
}

export function removeTodoItem(todos: TreeTodos, id: string): TreeTodos {
  return { ...todos, items: todos.items.filter((item) => item.id !== id) };
}

export function toggleTodoItem(todos: TreeTodos, id: string, done: boolean): TreeTodos {
  return {
    ...todos,
    items: todos.items.map((item) =>
      item.id === id ? { ...item, done, doneAt: done ? new Date().toISOString() : "" } : item,
    ),
  };
}

export function pruneTodosForPeople(todos: TreeTodos, personIds: Set<string>): TreeTodos {
  const items = todos.items.filter((item) => !item.personId || personIds.has(item.personId));
  if (items.length === todos.items.length) return todos;
  return { ...todos, items };
}

export function openTodoCount(todos: TreeTodos): number {
  return todos.items.filter((item) => !item.done).length;
}
