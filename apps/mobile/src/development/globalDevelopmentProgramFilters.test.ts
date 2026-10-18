// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import type { DevelopmentProgram } from "@daycare/api-client";
import { filterGlobalDevelopmentPrograms } from "./globalDevelopmentProgramFilters";

const programs = [
  { id: "one", name: "Bahasa Anak", description: "Mengenal kata baru", learningLevelId: "toddler", domain: "BAHASA_KOMUNIKASI", active: true },
  { id: "two", name: "Motorik Kasar", description: "Melatih keseimbangan", learningLevelId: "toddler", domain: "MOTORIK_KASAR", active: true },
  { id: "three", name: "Bahasa Lama", description: "Program arsip", learningLevelId: "preschool", domain: "BAHASA_KOMUNIKASI", active: false },
] as DevelopmentProgram[];

describe("filterGlobalDevelopmentPrograms", () => {
  const domainLabel = (domain: DevelopmentProgram["domain"]) => domain === "BAHASA_KOMUNIKASI" ? "Bahasa & Komunikasi" : "Motorik Kasar";

  it("searches name, description, and translated domain labels case-insensitively", () => {
    expect(filterGlobalDevelopmentPrograms(programs, { search: "KATA BARU", domainLabel }).map(({ id }) => id)).toEqual(["one"]);
    expect(filterGlobalDevelopmentPrograms(programs, { search: "bahasa & komunikasi", domainLabel }).map(({ id }) => id)).toEqual(["one", "three"]);
  });

  it("combines learning level, domain, and active-state filters", () => {
    expect(filterGlobalDevelopmentPrograms(programs, {
      learningLevelId: "toddler",
      domain: "MOTORIK_KASAR",
      active: true,
      domainLabel,
    }).map(({ id }) => id)).toEqual(["two"]);
    expect(filterGlobalDevelopmentPrograms(programs, { active: false, domainLabel }).map(({ id }) => id)).toEqual(["three"]);
  });

  it("shows every program when filters are unset and returns no results for unmatched search", () => {
    expect(filterGlobalDevelopmentPrograms(programs, { domainLabel })).toEqual(programs);
    expect(filterGlobalDevelopmentPrograms(programs, { search: "tidak ada", domainLabel })).toEqual([]);
  });
});
