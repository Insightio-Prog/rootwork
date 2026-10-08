import {
  displayName,
  type Person,
} from "./people";

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

function resolveTodoPersonId(value: string, people: Record<string, Person>): string | null {
  const personId = value.trim().replace(/^person:/i, "");
  if (!personId) return null;
  if (people[personId]) return personId;
  const prefix = personId.split(/[|:/\s]/)[0] ?? "";
  if (prefix && people[prefix]) return prefix;
  const needle = personId.toLowerCase();
  const exact = Object.values(people).filter((person) => displayName(person).toLowerCase() === needle);
  if (exact.length === 1) return exact[0].id;
  return personFromText(personId, people);
}

function personFromText(text: string, people: Record<string, Person>): string | null {
  const haystack = text.toLowerCase();
  if (!haystack.trim()) return null;
  const hits = Object.values(people)
    .map((person) => ({ id: person.id, name: displayName(person) }))
    .filter((person) => person.name.length > 3 && haystack.includes(person.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (hits.length === 0) return null;
  const best = hits[0];
  const tied = hits.filter((person) => person.name.length === best.name.length);
  return tied.length === 1 ? tied[0].id : null;
}

function stringField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function personIdForTodoRow(
  row: Partial<EvidenceTodo> & Record<string, unknown>,
  people: Record<string, Person>,
): string | null {
  const direct = [
    stringField(row, ["personId", "person_id", "person", "subjectId", "subject_id"]),
    stringField(row, ["id"]),
    stringField(row, ["title", "name", "task"]),
    stringField(row, ["detail", "note", "description", "reason"]),
  ];
  for (const value of direct) {
    const id = resolveTodoPersonId(value, people);
    if (id) return id;
  }
  return personFromText(direct.filter(Boolean).join(" "), people);
}

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
        if (!personId || !title) return [];
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

export function mergeGeneratedTodos(
  previous: TreeTodos,
  incoming: Omit<TreeTodos, "items"> & { items: Array<Partial<EvidenceTodo>> },
  people: Record<string, Person>,
): TreeTodos {
  const knownPersonIds = new Set(Object.keys(people));
  const priorById = new Map(previous.items.map((item) => [item.id, item]));
  const priorByKey = new Map(
    previous.items.map((item) => [`${item.personId}:${item.title.toLowerCase()}`, item]),
  );
  const generated = incoming.items.flatMap((row) => {
    const personId = personIdForTodoRow(row as Partial<EvidenceTodo> & Record<string, unknown>, people);
    const title =
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : stringField(row as Record<string, unknown>, ["name", "task", "title"]);
    if (!personId || !title) return [];
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `${personId}:${slugPart(title) || "item"}`;
    const prior = priorById.get(id) ?? priorByKey.get(`${personId}:${title.toLowerCase()}`);
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
        done: Boolean(prior?.done),
        doneAt: prior?.done ? prior.doneAt : "",
      },
    ];
  });
  const keptDone = previous.items.filter(
    (item) => item.done && knownPersonIds.has(item.personId) && !generated.some((row) => row.id === item.id),
  );
  const filled = generated;
  const summary =
    (incoming.summary ?? "").trim() ||
    (generated.length > 0 ? "" : "Claude did not return usable tasks.");
  return {
    generatedAt: incoming.generatedAt,
    model: incoming.model,
    summary,
    items: dedupeTodos([...filled, ...keptDone]).slice(0, 80),
  };
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
  const items = todos.items.filter((item) => personIds.has(item.personId));
  if (items.length === todos.items.length) return todos;
  return { ...todos, items };
}

export function openTodoCount(todos: TreeTodos): number {
  return todos.items.filter((item) => !item.done).length;
}
