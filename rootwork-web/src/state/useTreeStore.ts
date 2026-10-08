import { useCallback, useEffect, useRef, useState } from "react";
import {
  TREE_TITLE,
  createNotableEvent,
  createPerson,
  createJob,
  createMedal,
  createMilitaryService,
  createResidence,
  militaryOf,
  mediaRefsOfPerson,
  normalizePerson,
  omitRecordKey,
  uniqueIds,
  unlinkSibling,
  withMarriageDetails,
  withSiblingLink,
  type Person,
  type PersonDraft,
} from "../data/people";
import {
  EMPTY_TODOS,
  addTodoItem,
  removeTodoItem,
  normalizeTreeTodos,
  pruneTodosForPeople,
  toggleTodoItem,
  type TodoPriority,
  type TreeTodos,
} from "../data/todos";
import { deleteMedia, importMedia, importMediaFiles } from "../media/store";
import { flushStories, remapStoryPerson } from "../stories/store";
import { mergeGedcomTree as mergeGedcomIntoTree, collapseDuplicatePeople, type DuplicateMergeReport, type GedcomImportReport } from "../import/mergeGedcom";
import {
  createWorkspace,
  ensureWorkspaces,
  getCurrentTreeId,
  renameWorkspace,
  switchWorkspace,
  treeStorageKey,
  type WorkspaceIndex,
} from "./workspaces";

export type PersonLink =
  | { kind: "parent"; childId: string }
  | { kind: "spouse"; personId: string }
  | { kind: "child"; parentId: string; otherParentId?: string }
  | { kind: "sibling"; personId: string };

export type TreeState = {
  treeTitle: string;
  homePersonId: string | null;
  people: Record<string, Person>;
  todos: TreeTodos;
};

const EMPTY_TREE: TreeState = {
  treeTitle: TREE_TITLE,
  homePersonId: null,
  people: {},
  todos: EMPTY_TODOS,
};

export function parseTree(raw: string | null): TreeState {
  if (!raw) return EMPTY_TREE;
  try {
    const parsed = JSON.parse(raw) as Partial<TreeState>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY_TREE;
    const peopleRaw =
      parsed.people && typeof parsed.people === "object" && !Array.isArray(parsed.people)
        ? parsed.people
        : {};
    const people: Record<string, Person> = {};
    for (const [id, person] of Object.entries(peopleRaw)) {
      if (!person || typeof person !== "object") continue;
      people[id] = normalizePerson({ ...person, id: person.id || id });
    }
    const homePersonId =
      typeof parsed.homePersonId === "string" && people[parsed.homePersonId]
        ? parsed.homePersonId
        : Object.keys(people)[0] ?? null;
    return {
      treeTitle:
        typeof parsed.treeTitle === "string" && parsed.treeTitle.trim()
          ? parsed.treeTitle.trim()
          : EMPTY_TREE.treeTitle,
      homePersonId,
      people,
      todos: pruneTodosForPeople(normalizeTreeTodos(parsed.todos), new Set(Object.keys(people))),
    };
  } catch {
    return EMPTY_TREE;
  }
}

function loadTreeFromLocalStorage(): TreeState {
  const id = getCurrentTreeId();
  if (!id) return EMPTY_TREE;
  try {
    return parseTree(localStorage.getItem(treeStorageKey(id)));
  } catch {
    return EMPTY_TREE;
  }
}

function saveTree(tree: TreeState) {
  const id = getCurrentTreeId();
  if (id) localStorage.setItem(treeStorageKey(id), JSON.stringify(tree));
}

function linkSpouses(
  people: Record<string, Person>,
  aId: string,
  bId: string,
): Record<string, Person> {
  const a = people[aId];
  const b = people[bId];
  if (!a || !b || aId === bId) return people;
  return {
    ...people,
    [aId]: { ...a, spouseIds: uniqueIds([...a.spouseIds, bId]) },
    [bId]: { ...b, spouseIds: uniqueIds([...b.spouseIds, aId]) },
  };
}

function applyPersonLink(
  people: Record<string, Person>,
  personId: string,
  link?: PersonLink,
): Record<string, Person> {
  if (!link) return people;

  if (link.kind === "parent") {
    const child = people[link.childId];
    if (!child || child.id === personId || child.parentIds.includes(personId) || child.parentIds.length >= 2) {
      return people;
    }
    const otherParentId = child.parentIds[0];
    people = {
      ...people,
      [child.id]: { ...child, parentIds: uniqueIds([...child.parentIds, personId]) },
    };
    if (otherParentId) people = linkSpouses(people, personId, otherParentId);
    return people;
  }

  if (link.kind === "spouse") {
    return linkSpouses(people, personId, link.personId);
  }

  if (link.kind === "sibling") {
    return withSiblingLink(people, personId, link.personId);
  }

  const parent = people[link.parentId];
  const child = people[personId];
  if (!parent || !child || parent.id === personId || child.parentIds.includes(parent.id) || child.parentIds.length >= 2) {
    return people;
  }
  const extra =
    link.otherParentId &&
    link.otherParentId !== parent.id &&
    link.otherParentId !== personId &&
    people[link.otherParentId]
      ? link.otherParentId
      : undefined;
  const parentIds = uniqueIds(
    [...child.parentIds, parent.id, extra].filter((id): id is string => Boolean(id)),
  ).slice(0, 2);
  people = {
    ...people,
    [personId]: { ...child, parentIds },
  };
  if (extra) people = linkSpouses(people, parent.id, extra);
  return people;
}

export function useTreeStore() {
  const [tree, setTree] = useState<TreeState>(EMPTY_TREE);
  const [workspaces, setWorkspaces] = useState<WorkspaceIndex>({ currentId: "", trees: [] });
  const readyRef = useRef(false);
  const treeRef = useRef(tree);
  treeRef.current = tree;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await ensureWorkspaces();
      if (cancelled) return;
      setWorkspaces(next);
      setTree(loadTreeFromLocalStorage());
      readyRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    saveTree(tree);
  }, [tree]);

  const addPerson = useCallback((draft: PersonDraft, link?: PersonLink) => {
    const created = createPerson(draft);
    let nextId = created.id;

    setTree((current) => {
      const people = applyPersonLink(
        { ...current.people, [created.id]: created },
        created.id,
        link,
      );
      return {
        ...current,
        people,
        homePersonId: current.homePersonId ?? created.id,
      };
    });

    return nextId;
  }, []);

  const linkExistingPerson = useCallback((existingId: string, link: PersonLink) => {
    setTree((current) => {
      if (!current.people[existingId]) return current;
      return { ...current, people: applyPersonLink(current.people, existingId, link) };
    });
  }, []);

  const updatePerson = useCallback((id: string, draft: PersonDraft) => {
    setTree((current) => {
      const person = current.people[id];
      if (!person) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [id]: {
            ...person,
            givenName: draft.givenName.trim(),
            familyName: draft.familyName.trim(),
            gender: draft.gender,
            birth: draft.birth.trim(),
            birthPlace: draft.birthPlace.trim(),
            living: draft.living,
            death: draft.living ? "" : draft.death.trim(),
            deathPlace: draft.living ? "" : draft.deathPlace.trim(),
            nationality: (draft.nationality ?? "").trim(),
          },
        },
      };
    });
  }, []);

  const makeHome = useCallback((id: string) => {
    setTree((current) => (current.people[id] ? { ...current, homePersonId: id } : current));
  }, []);

  const removeParent = useCallback((childId: string, parentId: string) => {
    setTree((current) => {
      const child = current.people[childId];
      if (!child || !child.parentIds.includes(parentId)) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [childId]: {
            ...child,
            parentIds: child.parentIds.filter((id) => id !== parentId),
          },
        },
      };
    });
  }, []);

  const removeSpouse = useCallback((personId: string, spouseId: string) => {
    setTree((current) => {
      const person = current.people[personId];
      const spouse = current.people[spouseId];
      if (!person || !spouse) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            spouseIds: person.spouseIds.filter((id) => id !== spouseId),
            marriages: omitRecordKey(person.marriages, spouseId),
          },
          [spouseId]: {
            ...spouse,
            spouseIds: spouse.spouseIds.filter((id) => id !== personId),
            marriages: omitRecordKey(spouse.marriages, personId),
          },
        },
      };
    });
  }, []);

  const removeSibling = useCallback((personId: string, siblingId: string) => {
    setTree((current) => {
      const people = unlinkSibling(current.people, personId, siblingId);
      return people === current.people ? current : { ...current, people };
    });
  }, []);

  const deletePerson = useCallback((id: string) => {
    setTree((current) => {
      const removing = current.people[id];
      if (!removing) return current;
      for (const media of mediaRefsOfPerson(removing)) void deleteMedia(media);
      const people = Object.fromEntries(
        Object.entries(current.people)
          .filter(([personId]) => personId !== id)
          .map(([personId, person]) => [
            personId,
            {
              ...person,
              parentIds: person.parentIds.filter((parentId) => parentId !== id),
              spouseIds: person.spouseIds.filter((spouseId) => spouseId !== id),
              marriages: omitRecordKey(person.marriages, id),
            },
          ]),
      );
      const homePersonId =
        current.homePersonId && current.homePersonId !== id && people[current.homePersonId]
          ? current.homePersonId
          : Object.keys(people)[0] ?? null;
      return {
        ...current,
        people,
        homePersonId,
        todos: pruneTodosForPeople(current.todos, new Set(Object.keys(people))),
      };
    });
  }, []);

  const addResidence = useCallback((personId: string, place: string, from: string, to: string) => {
    setTree((current) => {
      const person = current.people[personId];
      if (!person || !place.trim()) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            residences: [...person.residences, createResidence(place, from, to)],
          },
        },
      };
    });
  }, []);

  const updateResidence = useCallback(
    (personId: string, residenceId: string, place: string, from: string, to: string) => {
      setTree((current) => {
        const person = current.people[personId];
        if (!person || !place.trim()) return current;
        return {
          ...current,
          people: {
            ...current.people,
            [personId]: {
              ...person,
              residences: person.residences.map((residence) =>
                residence.id === residenceId
                  ? { ...residence, place: place.trim(), from: from.trim(), to: to.trim() }
                  : residence,
              ),
            },
          },
        };
      });
    },
    [],
  );

  const removeResidence = useCallback((personId: string, residenceId: string) => {
    setTree((current) => {
      const person = current.people[personId];
      if (!person?.residences.some((item) => item.id === residenceId)) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            residences: person.residences.filter((item) => item.id !== residenceId),
          },
        },
      };
    });
  }, []);

  const addMilitaryService = useCallback((personId: string, served: string, war: string) => {
    if (!served.trim() && !war.trim()) return;
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            military: [...militaryOf(person), createMilitaryService(served, war)],
          },
        },
      };
    });
  }, []);

  const updateMilitaryService = useCallback(
    (personId: string, serviceId: string, served: string, war: string) => {
      if (!served.trim() && !war.trim()) return;
      setTree((current) => {
        const person = current.people[personId];
        if (!person) return current;
        return {
          ...current,
          people: {
            ...current.people,
            [personId]: {
              ...person,
              military: militaryOf(person).map((service) =>
                service.id === serviceId
                  ? { ...service, served: served.trim(), war: war.trim() }
                  : service,
              ),
            },
          },
        };
      });
    },
    [],
  );

  const removeMilitaryService = useCallback((personId: string, serviceId: string) => {
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      const service = militaryOf(person).find((item) => item.id === serviceId);
      if (!service) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            military: militaryOf(person).filter((item) => item.id !== serviceId),
          },
        },
      };
    });
  }, []);

  const addMedal = useCallback((personId: string, serviceId: string, name: string) => {
    if (!name.trim()) return;
    setTree((current) => {
      const person = current.people[personId];
      if (!person || !militaryOf(person).some((service) => service.id === serviceId)) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            military: militaryOf(person).map((service) =>
              service.id === serviceId
                ? { ...service, medals: [...service.medals, createMedal(name)] }
                : service,
            ),
          },
        },
      };
    });
  }, []);

  const updateMedal = useCallback((personId: string, serviceId: string, medalId: string, name: string) => {
    if (!name.trim()) return;
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            military: militaryOf(person).map((service) =>
              service.id === serviceId
                ? {
                    ...service,
                    medals: service.medals.map((medal) =>
                      medal.id === medalId ? { ...medal, name: name.trim() } : medal,
                    ),
                  }
                : service,
            ),
          },
        },
      };
    });
  }, []);

  const removeMedal = useCallback((personId: string, serviceId: string, medalId: string) => {
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      const medal = militaryOf(person)
        .find((service) => service.id === serviceId)
        ?.medals.find((item) => item.id === medalId);
      if (!medal) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            military: militaryOf(person).map((service) =>
              service.id === serviceId
                ? { ...service, medals: service.medals.filter((item) => item.id !== medalId) }
                : service,
            ),
          },
        },
      };
    });
  }, []);

  const addJob = useCallback((personId: string, title: string, detail: string) => {
    if (!title.trim()) return;
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            jobs: [...(person.jobs ?? []), createJob(title, detail)],
          },
        },
      };
    });
  }, []);

  const updateJob = useCallback((personId: string, jobId: string, title: string, detail: string) => {
    if (!title.trim()) return;
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            jobs: (person.jobs ?? []).map((job) =>
              job.id === jobId ? { ...job, title: title.trim(), detail: detail.trim() } : job,
            ),
          },
        },
      };
    });
  }, []);

  const removeJob = useCallback((personId: string, jobId: string) => {
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            jobs: (person.jobs ?? []).filter((job) => job.id !== jobId),
          },
        },
      };
    });
  }, []);

  const addNotableEvent = useCallback(
    (personId: string, title: string, date: string, detail: string) => {
      if (!title.trim()) return;
      const event = createNotableEvent(title, date, detail);
      setTree((current) => {
        const person = current.people[personId];
        if (!person) return current;
        return {
          ...current,
          people: {
            ...current.people,
            [personId]: { ...person, notableEvents: [...person.notableEvents, event] },
          },
        };
      });
    },
    [],
  );

  const updateNotableEvent = useCallback(
    (personId: string, eventId: string, title: string, date: string, detail: string) => {
      if (!title.trim()) return;
      setTree((current) => {
        const person = current.people[personId];
        if (!person) return current;
        return {
          ...current,
          people: {
            ...current.people,
            [personId]: {
              ...person,
              notableEvents: person.notableEvents.map((event) =>
                event.id === eventId
                  ? { ...event, title: title.trim(), date: date.trim(), detail: detail.trim() }
                  : event,
              ),
            },
          },
        };
      });
    },
    [],
  );

  const removeNotableEvent = useCallback((personId: string, eventId: string) => {
    setTree((current) => {
      const person = current.people[personId];
      const event = person?.notableEvents.find((item) => item.id === eventId);
      if (!person || !event) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            notableEvents: person.notableEvents.filter((item) => item.id !== eventId),
          },
        },
      };
    });
  }, []);

  const setMarriageDetails = useCallback(
    (personId: string, spouseId: string, date: string, place: string) => {
      setTree((current) => {
        const person = current.people[personId];
        const spouse = current.people[spouseId];
        if (!person || !spouse || !person.spouseIds.includes(spouseId)) return current;
        return {
          ...current,
          people: {
            ...current.people,
            [personId]: withMarriageDetails(person, spouseId, date, place),
            [spouseId]: withMarriageDetails(spouse, personId, date, place),
          },
        };
      });
    },
    [],
  );

  const setPhoto = useCallback(async (personId: string, file: File) => {
    const photo = await importMedia(file);
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      if (person.photo && person.photo.id !== photo.id) void deleteMedia(person.photo);
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: { ...person, photo },
        },
      };
    });
  }, []);

  const setFlag = useCallback(async (personId: string, file: File) => {
    const flag = await importMedia(file);
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      if (person.flag && person.flag.id !== flag.id) void deleteMedia(person.flag);
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: { ...person, flag },
        },
      };
    });
  }, []);

  const addPersonMedia = useCallback(async (personId: string, files: File[]) => {
    if (files.length === 0) return;
    const imported = await importMediaFiles(files);
    setTree((current) => {
      const person = current.people[personId];
      if (!person) {
        for (const file of imported) void deleteMedia(file);
        return current;
      }
      const seen = new Set(mediaRefsOfPerson(person).map((item) => item.id));
      const extra = imported.filter((file) => {
        if (seen.has(file.id)) {
          void deleteMedia(file);
          return false;
        }
        seen.add(file.id);
        return true;
      });
      if (extra.length === 0) return current;
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: { ...person, media: [...(person.media ?? []), ...extra] },
        },
      };
    });
  }, []);

  const removePersonMedia = useCallback((personId: string, mediaId: string) => {
    setTree((current) => {
      const person = current.people[personId];
      if (!person) return current;
      const isPhoto = person.photo?.id === mediaId;
      const inAlbum = (person.media ?? []).some((item) => item.id === mediaId);
      if (!isPhoto && !inAlbum) return current;
      const removing = isPhoto ? person.photo : (person.media ?? []).find((item) => item.id === mediaId);
      const usedElsewhere = Object.values(current.people).some(
        (other) => other.id !== personId && mediaRefsOfPerson(other).some((item) => item.id === mediaId),
      );
      if (removing && !usedElsewhere) void deleteMedia(removing);
      return {
        ...current,
        people: {
          ...current.people,
          [personId]: {
            ...person,
            photo: isPhoto ? null : person.photo,
            media: (person.media ?? []).filter((item) => item.id !== mediaId),
          },
        },
      };
    });
  }, []);

  const addTodo = useCallback(
    (input: { personId: string; title: string; detail: string; priority: TodoPriority }) => {
      setTree((current) => ({ ...current, todos: addTodoItem(current.todos, input) }));
    },
    [],
  );

  const removeTodo = useCallback((id: string) => {
    setTree((current) => ({ ...current, todos: removeTodoItem(current.todos, id) }));
  }, []);

  const setTodoDone = useCallback((id: string, done: boolean) => {
    setTree((current) => ({
      ...current,
      todos: toggleTodoItem(current.todos, id, done),
    }));
  }, []);

  const clearTodos = useCallback(() => {
    setTree((current) => ({ ...current, todos: EMPTY_TODOS }));
  }, []);

  const mergeGedcomTree = useCallback((text: string): GedcomImportReport => {
    const result = mergeGedcomIntoTree(treeRef.current, text);
    setTree(result.tree);
    for (const remap of result.remaps) {
      void remapStoryPerson(remap.from, remap.to);
    }
    return result.report;
  }, []);

  const collapseDuplicates = useCallback(async (): Promise<DuplicateMergeReport> => {
    const result = collapseDuplicatePeople(treeRef.current);
    setTree(result.tree);
    for (const remap of result.remaps) {
      await remapStoryPerson(remap.from, remap.to);
    }
    return result.report;
  }, []);

  const reloadFromDisk = useCallback(async () => {
    setTree(loadTreeFromLocalStorage());
  }, []);

  const switchTree = useCallback(async (id: string) => {
    if (id === getCurrentTreeId()) return;
    readyRef.current = false;
    saveTree(treeRef.current);
    await flushStories();
    const next = await switchWorkspace(id);
    setWorkspaces(next);
    setTree(loadTreeFromLocalStorage());
    readyRef.current = true;
  }, []);

  const createTree = useCallback(async (name: string) => {
    readyRef.current = false;
    saveTree(treeRef.current);
    await flushStories();
    const next = await createWorkspace(name);
    setWorkspaces(next);
    setTree(loadTreeFromLocalStorage());
    readyRef.current = true;
  }, []);

  const renameTree = useCallback(async (id: string, name: string) => {
    const next = await renameWorkspace(id, name);
    setWorkspaces(next);
    if (id === getCurrentTreeId()) {
      setTree((current) => ({ ...current, treeTitle: name.trim() || current.treeTitle }));
    }
  }, []);

  return {
    tree,
    addPerson,
    linkExistingPerson,
    updatePerson,
    makeHome,
    removeParent,
    removeSpouse,
    removeSibling,
    deletePerson,
    addResidence,
    updateResidence,
    removeResidence,
    addJob,
    updateJob,
    removeJob,
    addMilitaryService,
    updateMilitaryService,
    removeMilitaryService,
    addMedal,
    updateMedal,
    removeMedal,
    addNotableEvent,
    updateNotableEvent,
    removeNotableEvent,
    setMarriageDetails,
    setPhoto,
    setFlag,
    addPersonMedia,
    removePersonMedia,
    addTodo,
    removeTodo,
    setTodoDone,
    clearTodos,
    mergeGedcomTree,
    collapseDuplicates,
    reloadFromDisk,
    workspaces,
    switchTree,
    createTree,
    renameTree,
  };
}
