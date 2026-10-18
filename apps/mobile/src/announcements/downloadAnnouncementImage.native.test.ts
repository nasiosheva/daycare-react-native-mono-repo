// Mories Deo Hutapea,S.E.,S.Kom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadAnnouncementImage, shareAnnouncementImage } from "./downloadAnnouncementImage.native";

const mocks = vi.hoisted(() => ({
  downloadAsync: vi.fn(),
  moveAsync: vi.fn(),
  deleteAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  saveToLibraryAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock("expo-file-system", () => ({ cacheDirectory: "file:///cache/", downloadAsync: mocks.downloadAsync, moveAsync: mocks.moveAsync, deleteAsync: mocks.deleteAsync }));
vi.mock("expo-media-library", () => ({ requestPermissionsAsync: mocks.requestPermissionsAsync, saveToLibraryAsync: mocks.saveToLibraryAsync }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.isAvailableAsync, shareAsync: mocks.shareAsync }));

describe("native announcement image actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestPermissionsAsync.mockResolvedValue({ granted: true });
    mocks.downloadAsync.mockImplementation(async (_url: string, uri: string) => ({ uri, status: 200, mimeType: "image/jpeg", headers: {} }));
    mocks.isAvailableAsync.mockResolvedValue(true);
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.moveAsync.mockResolvedValue(undefined);
  });

  it("requests write-only photo permission and saves the image into the library", async () => {
    await downloadAnnouncementImage("https://cdn.example/notice.jpg", "Notice", "notice-1");

    expect(mocks.requestPermissionsAsync).toHaveBeenCalledWith(true, ["photo"]);
    expect(mocks.saveToLibraryAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/\d+-Notice-notice-1\.jpg$/));
    expect(mocks.deleteAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/\d+-Notice-notice-1\.jpg$/), { idempotent: true });
  });

  it("does not download or save when photo permission is denied", async () => {
    mocks.requestPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(downloadAnnouncementImage("https://cdn.example/notice.jpg", "Notice", "notice-1")).rejects.toThrow("operations.imageDownloadPermissionDenied");

    expect(mocks.downloadAsync).not.toHaveBeenCalled();
    expect(mocks.saveToLibraryAsync).not.toHaveBeenCalled();
  });

  it("shares the image file through the native system share sheet", async () => {
    await expect(shareAnnouncementImage("https://cdn.example/notice.jpg", "Notice", "notice-1")).resolves.toBe("shared");

    expect(mocks.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/\d+-Notice-notice-1\.jpg$/), expect.objectContaining({ mimeType: "image/jpeg", dialogTitle: "Notice" }));
    expect(mocks.deleteAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/\d+-Notice-notice-1\.jpg$/), { idempotent: true });
  });
});
