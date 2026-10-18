// Mories Deo Hutapea,S.E.,S.Kom
import type { TenantAnnouncement, TenantAnnouncementAudience, TenantAnnouncementStatus } from "@daycare/api-client";
import { normalizeSearchText } from "../text/normalizeSearchText";

type TenantAnnouncementFilterOptions = {
  search?: string;
  status?: TenantAnnouncementStatus;
  audience?: TenantAnnouncementAudience;
  audienceLabel?: (audience: TenantAnnouncementAudience) => string;
};

export function filterTenantAnnouncements(
  announcements: readonly TenantAnnouncement[],
  filters: TenantAnnouncementFilterOptions,
): TenantAnnouncement[] {
  const query = normalizeSearchText(filters.search ?? "");

  return announcements.filter((announcement) => {
    if (filters.status && announcement.status !== filters.status) return false;
    if (filters.audience && announcement.audience !== filters.audience) return false;
    if (!query) return true;

    const searchableValues = [
      announcement.title,
      announcement.body,
      filters.audienceLabel?.(announcement.audience) ?? "",
    ];
    return searchableValues.some((value) => normalizeSearchText(value).includes(query));
  });
}
