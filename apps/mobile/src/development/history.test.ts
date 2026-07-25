import { describe, expect, it } from "vitest";
import type { DevelopmentEntry } from "@daycare/api-client";
import { groupDevelopmentEntries } from "./history";

describe("groupDevelopmentEntries", () => {
  it("groups entries by category while retaining the API order", () => {
    const entries = [
      { id: "entry-1", childId: "child-1", category: "ACTIVITY", categoryName: "Aktivitas", title: "Kolase", content: "Membuat kolase", recordedAt: "2026-07-25T09:00:00Z", recordedBy: "Guru" },
      { id: "entry-2", childId: "child-1", category: "MEAL", categoryName: "Makan", title: "Makan siang", content: "Habis", recordedAt: "2026-07-25T08:00:00Z", recordedBy: "Guru" },
      { id: "entry-3", childId: "child-1", category: "ACTIVITY", categoryName: "Aktivitas", title: "Mewarnai", content: "Selesai", recordedAt: "2026-07-25T07:00:00Z", recordedBy: "Guru" },
    ] satisfies DevelopmentEntry[];

    expect(groupDevelopmentEntries(entries)).toEqual([
      { category: "ACTIVITY", categoryName: "Aktivitas", entries: [entries[0], entries[2]] },
      { category: "MEAL", categoryName: "Makan", entries: [entries[1]] },
    ]);
  });
});
