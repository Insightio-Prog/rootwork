import { describe, expect, it } from "vitest";
import { createPerson, normalizePerson, noteSnippet } from "./people";

describe("sticky notes", () => {
  it("shortens long notes on one line", () => {
    expect(noteSnippet("Short")).toBe("Short");
    const long = noteSnippet("Thomas moved to Wigan after the mill closed and never went back", 30);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("…")).toBe(true);
    expect(noteSnippet("a\n\n  b")).toBe("a b");
  });

  it("keeps good notes and drops empty ones when loading", () => {
    const base = createPerson({ givenName: "A", familyName: "B", gender: "male", birth: "", birthPlace: "", death: "", deathPlace: "", living: true, nationality: "" });
    const loaded = normalizePerson({
      ...base,
      stickyNotes: [{ id: "n1", text: "  hello ", createdAt: "2026-10-08", updatedAt: "2026-10-08" }, { id: "n2", text: "  " }],
    } as never);
    expect(loaded.stickyNotes).toHaveLength(1);
    expect(loaded.stickyNotes[0].text).toBe("hello");
    expect(normalizePerson({ ...base, stickyNotes: undefined } as never).stickyNotes).toEqual([]);
  });
});
