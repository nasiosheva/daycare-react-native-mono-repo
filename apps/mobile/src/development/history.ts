import type { DevelopmentEntry } from "@daycare/api-client";

export type DevelopmentEntryGroup = {
  category: string;
  categoryName: string;
  entries: DevelopmentEntry[];
};

export function groupDevelopmentEntries(entries: readonly DevelopmentEntry[]): DevelopmentEntryGroup[] {
  const groups = new Map<string, DevelopmentEntryGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.category);
    if (group) group.entries.push(entry);
    else groups.set(entry.category, { category: entry.category, categoryName: entry.categoryName, entries: [entry] });
  }
  return [...groups.values()];
}
