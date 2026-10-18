// Mories Deo Hutapea,S.E.,S.Kom
import type { PlatformBanner, PlatformBannerAudience, PlatformBannerStatus } from "@daycare/api-client";
import { normalizeSearchText } from "../text/normalizeSearchText";

type PlatformBannerFilterOptions = {
  search?: string;
  status?: PlatformBannerStatus;
  audience?: PlatformBannerAudience;
  audienceLabel?: (audience: PlatformBannerAudience) => string;
};

export function filterPlatformBanners(
  banners: readonly PlatformBanner[],
  filters: PlatformBannerFilterOptions,
): PlatformBanner[] {
  const query = normalizeSearchText(filters.search ?? "");

  return banners.filter((banner) => {
    if (filters.status && banner.status !== filters.status) return false;
    if (filters.audience && banner.audience !== filters.audience) return false;
    if (!query) return true;

    const searchableValues = [
      banner.title,
      banner.targetOrganizationName ?? "",
      banner.audience && filters.audienceLabel ? filters.audienceLabel(banner.audience) : "",
    ];
    return searchableValues.some((value) => normalizeSearchText(value).includes(query));
  });
}
