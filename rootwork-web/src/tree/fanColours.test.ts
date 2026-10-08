import { describe, expect, it } from "vitest";
import { createPerson } from "../data/people";
import { eraOf, lifespanOf } from "./fanColours";

function p(birth: string, death: string, living = false) {
  return createPerson({ givenName: "A", familyName: "B", gender: "male", birth, birthPlace: "", death, deathPlace: "", living, nationality: "" });
}

describe("fan colours", () => {
  it("bins by birth era", () => {
    expect(eraOf(p("1854", "1923")).key).toBe("1850");
    expect(eraOf(p("1780", "")).key).toBe("pre1800");
    expect(eraOf(p("", "")).key).toBe("none");
  });
  it("bins by age at death", () => {
    expect(lifespanOf(p("1854", "1923")).key).toBe("60s");
    expect(lifespanOf(p("1900", "1905")).key).toBe("young");
    expect(lifespanOf(p("1950", "", true)).key).toBe("living");
    expect(lifespanOf(p("1900", "")).key).toBe("none");
  });
});
