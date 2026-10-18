// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import { announcementImageDownloadInfo } from "./announcementImageDownload";

describe("announcementImageDownloadInfo", () => {
  it("keeps the extension from an image URL even when it has query parameters", () => {
    expect(announcementImageDownloadInfo("https://cdn.example/promo.webp?token=one", "Promo anak", "notice-123")).toEqual({
      fileName: "Promo-anak-notice-123.webp",
      mimeType: "image/webp",
    });
  });

  it("uses the response image format when the URL has no file extension", () => {
    expect(announcementImageDownloadInfo("https://cdn.example/image?id=123", "Kegiatan", "notice-456", "image/png; charset=binary")).toEqual({
      fileName: "Kegiatan-notice-456.png",
      mimeType: "image/png",
    });
  });

  it("uses safe fallback filename parts when title or id contains no usable characters", () => {
    expect(announcementImageDownloadInfo("https://cdn.example/notice.jpg", "💛", "---")).toEqual({
      fileName: "announcement-image.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("rejects invalid URLs, non-image responses, and unknown formats", () => {
    expect(() => announcementImageDownloadInfo("http://cdn.example/promo.jpg", "Promo", "notice")).toThrow("operations.imageDownloadInvalidUrl");
    expect(() => announcementImageDownloadInfo("https://cdn.example/promo.jpg", "Promo", "notice", "text/html")).toThrow("operations.imageDownloadInvalidFormat");
    expect(() => announcementImageDownloadInfo("https://cdn.example/image?id=123", "Promo", "notice")).toThrow("operations.imageDownloadInvalidFormat");
    expect(() => announcementImageDownloadInfo("https://cdn.example/promo.jpg", "Promo", "notice", "image/x-icon")).toThrow("operations.imageDownloadInvalidFormat");
  });
});
