import { describe, expect, it } from "vitest";
import { createPerson, type Person } from "../data/people";
import { computeHeritage } from "./heritage";

function person(id: string, nationality: string, parentIds: string[] = []): Person {
  const p = createPerson({ givenName: id, familyName: "X", gender: "male", birth: "", birthPlace: "", death: "", deathPlace: "", living: true, nationality });
  p.id = id;
  p.parentIds = parentIds;
  return p;
}

describe("computeHeritage", () => {
  it("splits half from each parent and counts a missing parent as unknown", () => {
    const people = {
      a: person("a", "", ["b", "c"]),
      b: person("b", "English"),
      c: person("c", "", ["d"]),
      d: person("d", "Welsh"),
    };
    const result = Object.fromEntries(computeHeritage(people, "a").map((item) => [item.label, item.share]));
    expect(result).toEqual({ English: 0.5, Welsh: 0.25, Unknown: 0.25 });
  });
});
