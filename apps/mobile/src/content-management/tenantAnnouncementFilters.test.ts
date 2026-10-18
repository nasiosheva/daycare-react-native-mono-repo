// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import type { TenantAnnouncement } from "@daycare/api-client";
import { filterTenantAnnouncements } from "./tenantAnnouncementFilters";

const announcements = [
  { id: "one", title: "Libur bersama", body: "Informasi jadwal", audience: "TENANT", status: "PUBLISHED", createdAt: "2026-10-18T09:00:00Z", requiresAcknowledgement: false, acknowledgedByMe: false, recipientCount: 2 },
  { id: "two", title: "Jadwal cabang", body: "Perubahan jam", audience: "BRANCH", status: "SCHEDULED", createdAt: "2026-10-18T09:00:00Z", requiresAcknowledgement: true, acknowledgedByMe: false, recipientCount: 1 },
  { id: "three", title: "Draft kegiatan", body: "Rencana acara", audience: "TENANT", status: "DRAFT", createdAt: "2026-10-18T09:00:00Z", requiresAcknowledgement: false, acknowledgedByMe: false, recipientCount: 0 },
] as TenantAnnouncement[];

describe("filterTenantAnnouncements", () => {
  it("searches title, legacy body, and translated audience label without case sensitivity", () => {
    const audienceLabel = (audience: TenantAnnouncement["audience"]) => audience === "BRANCH" ? "Cabang" : "Semua tenant";

    expect(filterTenantAnnouncements(announcements, { search: "LIBUR BERSAMA" }).map(({ id }) => id)).toEqual(["one"]);
    expect(filterTenantAnnouncements(announcements, { search: "perubahan jam" }).map(({ id }) => id)).toEqual(["two"]);
    expect(filterTenantAnnouncements(announcements, { search: "cabang", audienceLabel }).map(({ id }) => id)).toEqual(["two"]);
  });

  it("combines lifecycle status and recipient-scope filters", () => {
    expect(filterTenantAnnouncements(announcements, { status: "DRAFT", audience: "TENANT" }).map(({ id }) => id)).toEqual(["three"]);
    expect(filterTenantAnnouncements(announcements, { status: "PUBLISHED", audience: "BRANCH" })).toEqual([]);
  });

  it("returns all announcements when filters are unset and none for unmatched search", () => {
    expect(filterTenantAnnouncements(announcements, {})).toEqual(announcements);
    expect(filterTenantAnnouncements(announcements, { search: "tidak ditemukan" })).toEqual([]);
  });
});
