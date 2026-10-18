// Mories Deo Hutapea,S.E.,S.Kom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareAnnouncementImage } from "./downloadAnnouncementImage.web";

describe("web announcement image sharing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Web Share when the browser supports it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });

    await expect(shareAnnouncementImage("https://cdn.example/notice.jpg", "Notice", "notice-1")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Notice", url: "https://cdn.example/notice.jpg" });
  });

  it("copies the image link when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(shareAnnouncementImage("https://cdn.example/notice.jpg", "Notice", "notice-1")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://cdn.example/notice.jpg");
  });

  it("rejects non-HTTPS image links before sharing", async () => {
    await expect(shareAnnouncementImage("http://cdn.example/notice.jpg", "Notice", "notice-1")).rejects.toThrow("operations.imageDownloadInvalidUrl");
  });
});
