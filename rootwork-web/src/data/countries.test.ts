import { describe, expect, it } from "vitest";
import { flagCodeFor, flagCodeFromPlace } from "./countries";

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

describe("flagCodeFromPlace", () => {
  it("reads the country from a birthplace", () => {
    expect(flagCodeFromPlace("Chippenham, Wiltshire, England")).toBe("gb-eng");
    expect(flagCodeFromPlace("Rhondda, Pontypridd, Glamorganshire, Wales")).toBe("gb-wls");
    expect(flagCodeFromPlace("Pontypridd, Glamorganshire")).toBe("gb-wls");
    expect(flagCodeFromPlace("St. Michans, Dublin, Do")).toBe("ie");
    expect(flagCodeFromPlace("West Monkton Somerset England")).toBe("gb-eng");
    expect(flagCodeFromPlace("Sydney, New South Wales, Australia")).toBe("au");
    expect(flagCodeFromPlace("Nowhere")).toBeNull();
  });
});
