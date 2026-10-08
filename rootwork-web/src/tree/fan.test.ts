import { describe, expect, it } from "vitest";
import { createPerson, type Person } from "../data/people";
import { buildFanSlots, fanRingsNeeded } from "./fan";

function person(id: string, gender: "male" | "female", parentIds: string[] = []): Person {
  const p = createPerson({ givenName: id, familyName: "X", gender, birth: "", birthPlace: "", death: "", deathPlace: "", living: true, nationality: "" });
  p.id = id;
  p.parentIds = parentIds;
  return p;
}

describe("fan layout", () => {
  const people = {
    me: person("me", "male", ["dad", "mum"]),
    dad: person("dad", "male", ["gdad", "gmum"]),
    mum: person("mum", "female"),
    gdad: person("gdad", "male"),
    gmum: person("gmum", "female"),
  };

  it("only draws as deep as the known ancestors, plus one row of stubs", () => {
    expect(fanRingsNeeded(people, "me", 8)).toBe(3);
    expect(Math.max(...buildFanSlots(people, "me", 8).map((s) => s.generation))).toBe(3);
  });

  it("gives known branches more room than empty stubs and never overlaps", () => {
    const slots = buildFanSlots(people, "me", 8);
    const width = (id: string) => {
      const s = slots.find((slot) => slot.person?.id === id)!;
      return s.a0 - s.a1;
    };
    expect(width("dad")).toBeCloseTo(width("mum"), 5); // parents share the half-turn evenly
    const stub = slots.find((s) => !s.person && s.generation === 2 && s.childId === "mum")!;
    expect(stub.a0 - stub.a1).toBeLessThan(width("gdad") * 2);
    const ring3 = slots.filter((s) => s.generation === 3).sort((a, b) => b.mid - a.mid);
    for (let i = 1; i < ring3.length; i++) expect(ring3[i].a0).toBeLessThanOrEqual(ring3[i - 1].a1 + 1e-9);
  });
});
