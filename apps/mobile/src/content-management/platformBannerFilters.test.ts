// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import type { PlatformBanner } from "@daycare/api-client";
import { filterPlatformBanners } from "./platformBannerFilters";

const banners = [
  { id: "one", title: "Promo PAUD", imageUrl: "https://cdn.example/one.jpg", body: "", status: "PUBLISHED", audience: "PARENT_GLOBAL", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
  { id: "two", title: "Pendaftaran Staff", imageUrl: "https://cdn.example/two.jpg", body: "", status: "DRAFT", audience: "TENANT_STAFF_ADMIN", targetOrganizationName: "Nasio Care", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
  { id: "three", title: "Update platform", imageUrl: "https://cdn.example/three.jpg", body: "", status: "SCHEDULED", audience: "STAFF_ADMIN_GLOBAL", createdAt: "2026-10-18T09:00:00Z", updatedAt: "2026-10-18T09:00:00Z" },
] as PlatformBanner[];

describe("filterPlatformBanners", () => {
  it("searches banner title, tenant name, and translated audience label without case sensitivity", () => {
    const audienceLabel = (audience: NonNullable<PlatformBanner["audience"]>) => audience === "TENANT_STAFF_ADMIN" ? "Staff Admin tenant" : audience;

    expect(filterPlatformBanners(banners, { search: "promo paud" }).map(({ id }) => id)).toEqual(["one"]);
    expect(filterPlatformBanners(banners, { search: "NASIO care" }).map(({ id }) => id)).toEqual(["two"]);
    expect(filterPlatformBanners(banners, { search: "staff admin tenant", audienceLabel }).map(({ id }) => id)).toEqual(["two"]);
  });

  it("combines lifecycle status and audience filters", () => {
    expect(filterPlatformBanners(banners, { status: "DRAFT", audience: "TENANT_STAFF_ADMIN" }).map(({ id }) => id)).toEqual(["two"]);
    expect(filterPlatformBanners(banners, { status: "PUBLISHED", audience: "STAFF_ADMIN_GLOBAL" })).toEqual([]);
  });

  it("returns all banners when filters are unset and none for unmatched search", () => {
    expect(filterPlatformBanners(banners, {})).toEqual(banners);
    expect(filterPlatformBanners(banners, { search: "tidak ditemukan" })).toEqual([]);
  });
});
