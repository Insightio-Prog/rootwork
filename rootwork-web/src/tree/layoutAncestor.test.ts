import { describe, expect, it } from "vitest";
import { familyLayoutConstants } from "../chart/familyLayout";
import { createPerson, emptyDraft, type Person } from "../data/people";
import { familyTrunks, layoutAncestorCards } from "./layout";

function makePerson(id: string, gender: "female" | "male", birth: string): Person {
  return { ...createPerson(emptyDraft({ givenName: id, familyName: "Test", gender, birth })), id };
}

function tree() {
  const father = makePerson("father", "male", "1950");
  const mother = makePerson("mother", "female", "1952");
  father.spouseIds = ["mother"];
  mother.spouseIds = ["father"];
  const home = makePerson("home", "female", "1980");
  const spouse = makePerson("spouse", "male", "1978");
  home.spouseIds = ["spouse"];
  spouse.spouseIds = ["home"];
  home.parentIds = ["father", "mother"];
  const sibling = makePerson("sibling", "male", "1982");
  sibling.parentIds = ["father", "mother"];
  const child = makePerson("child", "female", "2008");
  child.parentIds = ["home", "spouse"];
  const people = Object.fromEntries(
    [father, mother, home, spouse, sibling, child].map((person) => [person.id, person]),
  );
  return people;
}

describe("layoutAncestorCards", () => {
  it("applies drag offsets on top of the family-block auto layout", () => {
    const people = tree();
    const auto = layoutAncestorCards(people, "home", 4, {});
    const moved = layoutAncestorCards(people, "home", 4, { home: { dx: 12, dy: -8 } });
    const autoHome = auto.cards.find((card) => card.id === "home");
    const movedHome = moved.cards.find((card) => card.id === "home");
    const autoChild = auto.cards.find((card) => card.id === "child");
    const movedChild = moved.cards.find((card) => card.id === "child");
    expect(autoHome).toBeTruthy();
    expect(movedHome).toBeTruthy();
    expect(movedHome?.x).toBe((autoHome?.x ?? 0) + 12);
    expect(movedHome?.y).toBe((autoHome?.y ?? 0) - 8);
    expect(movedChild?.x).toBe(autoChild?.x);
    expect(movedChild?.y).toBe(autoChild?.y);
  });

  it("hides a person's descendants when they are in collapsedIds", () => {
    const people = tree();
    const shown = layoutAncestorCards(people, "home", 4, {});
    expect(shown.cards.map((card) => card.id).sort()).toEqual(
      ["child", "father", "home", "mother", "sibling", "spouse"].sort(),
    );
    const hidden = layoutAncestorCards(people, "home", 4, {}, ["home"]);
    expect(hidden.cards.map((card) => card.id).sort()).toEqual(
      ["father", "home", "mother", "sibling", "spouse"].sort(),
    );
  });

  it("centres connector trunks in the column gap", () => {
    const people = tree();
    const constants = familyLayoutConstants({ COLUMN_GAP: 220 });
    const { cards } = layoutAncestorCards(people, "home", 4, {}, [], constants);
    const home = cards.find((card) => card.id === "home");
    const father = cards.find((card) => card.id === "father");
    expect(home && father).toBeTruthy();
    if (!home || !father) return;
    const mid = home.x + home.w + (father.x - (home.x + home.w)) / 2;
    const trunks = familyTrunks(cards);
    expect(trunks.some((edge) => edge.d.includes(`M ${Math.round(mid)} `) || edge.d.startsWith(`M ${Math.round(mid)} `))).toBe(true);
  });

  it("offsets overlapping family trunks into x lanes", () => {
    const people = tree();
    const { cards } = layoutAncestorCards(people, "home", 4, {});
    const verticals = familyTrunks(cards)
      .filter((edge) => edge.key.startsWith("trunk-"))
      .map((edge) => {
        const match = edge.d.match(/^M (-?\d+) (-?\d+) V (-?\d+)/);
        expect(match, `trunk ${edge.key} should start with a vertical`).toBeTruthy();
        return {
          key: edge.key,
          x: Number(match?.[1]),
          y1: Number(match?.[2]),
          y2: Number(match?.[3]),
        };
      });
    for (let i = 0; i < verticals.length; i++) {
      for (let j = i + 1; j < verticals.length; j++) {
        const a = verticals[i];
        const b = verticals[j];
        const overlap = a.y1 <= b.y2 && b.y1 <= a.y2;
        if (!overlap) continue;
        expect(a.x, `overlapping trunks ${a.key} and ${b.key} must use different x lanes`).not.toBe(b.x);
      }
    }
  });

  it("places overlapping same-gutter trunks 16px apart", () => {
    const card = (
      id: string,
      x: number,
      y: number,
      parentIds: string[] = [],
      spouseIds: string[] = [],
    ) => ({ id, generation: 0, x, y, w: 250, h: 70, parentIds, spouseIds });
    const trunks = familyTrunks([
      card("p1", 410, 0, [], []),
      card("c1", 0, 200, ["p1"], []),
      card("p2", 410, 80, [], []),
      card("c2", 0, 140, ["p2"], []),
    ]).filter((edge) => edge.key.startsWith("trunk-"));
    const xs = trunks.map((edge) => Number(edge.d.match(/^M (-?\d+)/)?.[1]));
    expect(xs.length).toBe(2);
    expect(Math.abs(xs[0] - xs[1])).toBe(16);
  });
});
