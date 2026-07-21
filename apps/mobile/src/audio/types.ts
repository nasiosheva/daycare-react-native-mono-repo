export const AUDIO_RECORDING_MAX_DURATION_MS = 5 * 60 * 1000;

export type AudioRecording = {
  uri: string;
  durationMs: number;
  mimeType: "audio/mp4";
  fileExtension: ".m4a";
  createdAt: string;
  fileSizeBytes?: number;
};

export type AudioRecordingStatus = "idle" | "requesting_permission" | "recording" | "completed" | "error" | "unsupported";

export type AudioRecordingErrorCode = "permission_denied" | "recording_failed" | "unsupported";

export type AudioRecordingError = {
  code: AudioRecordingErrorCode;
  message: string;
};

export type AudioRecordingController = {
  status: AudioRecordingStatus;
  durationMs: number;
  recording: AudioRecording | null;
  error: AudioRecordingError | null;
  start: () => Promise<boolean>;
  stop: () => Promise<AudioRecording | null>;
  cancel: () => Promise<void>;
  clear: () => Promise<void>;
};

export function createAudioRecording(uri: string, durationMs: number, createdAt: Date, fileSizeBytes?: number): AudioRecording {
  return {
    uri,
    durationMs: Math.min(Math.max(0, durationMs), AUDIO_RECORDING_MAX_DURATION_MS),
    mimeType: "audio/mp4",
    fileExtension: ".m4a",
    createdAt: createdAt.toISOString(),
    ...(fileSizeBytes === undefined ? {} : { fileSizeBytes }),
  };
}
