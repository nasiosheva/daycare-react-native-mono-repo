// Mories Deo Hutapea,S.E.,S.Kom
export type AttendanceStatus = "NOT_YET" | "PRESENT" | "LEFT";
export type AttendanceStatusFilter = "ALL" | AttendanceStatus;
export type AttendanceActionForStatus = "CHECK_IN" | "CHECK_OUT" | null;

type RosterChild = { fullName: string; todayCheckedInAt?: string | null; todayCheckedOutAt?: string | null };

export function attendanceStatus(child: RosterChild): AttendanceStatus {
  if (child.todayCheckedOutAt) return "LEFT";
  if (child.todayCheckedInAt) return "PRESENT";
  return "NOT_YET";
}

export function attendanceAction(status: AttendanceStatus): AttendanceActionForStatus {
  if (status === "NOT_YET") return "CHECK_IN";
  if (status === "PRESENT") return "CHECK_OUT";
  return null;
}

/** Case- and accent-insensitive "contains" match used by the local search boxes. */
export function matchesQuery(text: string, query: string): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const needle = normalize(query);
  return !needle || normalize(text).includes(needle);
}

export function rosterCounts(children: readonly RosterChild[]): Record<AttendanceStatusFilter, number> {
  const counts: Record<AttendanceStatusFilter, number> = { ALL: children.length, NOT_YET: 0, PRESENT: 0, LEFT: 0 };
  for (const child of children) counts[attendanceStatus(child)] += 1;
  return counts;
}

export function filterRoster<T extends RosterChild>(children: readonly T[], query: string, status: AttendanceStatusFilter): T[] {
  return children.filter((child) => (status === "ALL" || attendanceStatus(child) === status) && matchesQuery(child.fullName, query));
}
