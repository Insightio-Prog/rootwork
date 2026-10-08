import { describe, expect, it } from "vitest";
import { flagCodeFor } from "./countries";

describe("flagCodeFor", () => {
  it("understands countries, nationalities and the UK nations", () => {
    expect(flagCodeFor("Welsh")).toBe("gb-wls");
    expect(flagCodeFor("wales")).toBe("gb-wls");
    expect(flagCodeFor("Irish")).toBe("ie");
    expect(flagCodeFor("USA")).toBe("us");
    expect(flagCodeFor("English / Irish")).toBe("gb-eng");
    expect(flagCodeFor("Atlantis")).toBeNull();
    expect(flagCodeFor("")).toBeNull();
  });
});
