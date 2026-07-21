import { describe, expect, it } from "vitest";
import { IMAGE_PICKER_MAX_SELECTION, IMAGE_PICKER_QUALITY, createPickedImage, createPickedImages } from "./types";

describe("createPickedImage", () => {
  it("normalizes local image metadata for a library selection", () => {
    const image = createPickedImage({
      uri: "file:///cache/child.jpg",
      fileName: "child.jpg",
      mimeType: "image/jpeg",
      fileSize: 512,
      width: 1600,
      height: 1200,
    }, "library", new Date("2026-07-21T00:00:00.000Z"));

    expect(image).toEqual({
      uri: "file:///cache/child.jpg",
      source: "library",
      fileName: "child.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 512,
      width: 1600,
      height: 1200,
      selectedAt: "2026-07-21T00:00:00.000Z",
    });
  });

  it("uses the agreed picker limits", () => {
    expect(IMAGE_PICKER_MAX_SELECTION).toBe(10);
    expect(IMAGE_PICKER_QUALITY).toBe(0.8);
  });

  it("returns no image for a cancelled result and enforces the selection limit", () => {
    const asset = { uri: "file:///cache/child.jpg", width: 1600, height: 1200 };

    expect(createPickedImages(null, "library", new Date())).toEqual([]);
    expect(createPickedImages(Array.from({ length: IMAGE_PICKER_MAX_SELECTION + 1 }, () => asset), "library", new Date())).toHaveLength(IMAGE_PICKER_MAX_SELECTION);
  });
});
