import { describe, expect, it } from "vitest";
import { AUDIO_RECORDING_MAX_DURATION_MS, createAudioRecording } from "./types";

describe("createAudioRecording", () => {
  it("returns an upload-ready M4A cache descriptor", () => {
    const recording = createAudioRecording("file:///cache/voice-note.m4a", 4_500, new Date("2026-07-21T00:00:00.000Z"), 512);

    expect(recording).toEqual({
      uri: "file:///cache/voice-note.m4a",
      durationMs: 4_500,
      mimeType: "audio/mp4",
      fileExtension: ".m4a",
      createdAt: "2026-07-21T00:00:00.000Z",
      fileSizeBytes: 512,
    });
  });

  it("limits reported duration to the five-minute recording policy", () => {
    const recording = createAudioRecording("file:///cache/voice-note.m4a", AUDIO_RECORDING_MAX_DURATION_MS + 1, new Date());

    expect(recording.durationMs).toBe(AUDIO_RECORDING_MAX_DURATION_MS);
  });
});
