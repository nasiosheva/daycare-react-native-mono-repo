import { describe, expect, it } from "vitest";
import { attendanceStatus, filterRoster, matchesQuery, rosterCounts } from "./attendanceRoster";

const roster = [
  { fullName: "Ayu Lestari", todayCheckedInAt: "2026-09-26T07:30:00Z", todayCheckedOutAt: null },
  { fullName: "Bima Saputra", todayCheckedInAt: "2026-09-26T07:45:00Z", todayCheckedOutAt: "2026-09-26T16:00:00Z" },
  { fullName: "Chandra", todayCheckedInAt: null, todayCheckedOutAt: null },
];

describe("attendance roster", () => {
  it("derives today's status from check-in and check-out times", () => {
    expect(roster.map(attendanceStatus)).toEqual(["PRESENT", "LEFT", "NOT_YET"]);
  });

  it("counts children per status", () => {
    expect(rosterCounts(roster)).toEqual({ ALL: 3, NOT_YET: 1, PRESENT: 1, LEFT: 1 });
  });

  it("filters by status and by name together", () => {
    expect(filterRoster(roster, "", "NOT_YET").map((child) => child.fullName)).toEqual(["Chandra"]);
    expect(filterRoster(roster, "saputra", "ALL").map((child) => child.fullName)).toEqual(["Bima Saputra"]);
    expect(filterRoster(roster, "ayu", "LEFT")).toEqual([]);
  });

  it("matches names regardless of case, accents and surrounding spaces", () => {
    expect(matchesQuery("Zoë Anggraini", "  zoe ")).toBe(true);
    expect(matchesQuery("Ayu", "")).toBe(true);
    expect(matchesQuery("Ayu", "bima")).toBe(false);
  });
});
