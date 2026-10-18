// Mories Deo Hutapea,S.E.,S.Kom
import type { DevelopmentProgram } from "@daycare/api-client";

type GlobalDevelopmentProgramFilterOptions = {
  search?: string;
  learningLevelId?: string;
  domain?: DevelopmentProgram["domain"];
  active?: boolean;
  domainLabel: (domain: DevelopmentProgram["domain"]) => string;
};

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function filterGlobalDevelopmentPrograms(
  programs: DevelopmentProgram[],
  filters: GlobalDevelopmentProgramFilterOptions,
): DevelopmentProgram[] {
  const query = normalizeSearchText(filters.search ?? "");

  return programs.filter((program) => {
    if (filters.learningLevelId && program.learningLevelId !== filters.learningLevelId) return false;
    if (filters.domain && program.domain !== filters.domain) return false;
    if (filters.active !== undefined && program.active !== filters.active) return false;
    if (!query) return true;

    return [program.name, program.description, filters.domainLabel(program.domain)]
      .some((value) => normalizeSearchText(value).includes(query));
  });
}
