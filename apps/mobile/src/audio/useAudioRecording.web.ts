import { useCallback, useState } from "react";
import type { AudioRecordingController, AudioRecordingError } from "./types";

const unsupportedError: AudioRecordingError = {
  code: "unsupported",
  message: "Audio recording is available on Android and iOS only.",
};

export function useAudioRecording(): AudioRecordingController {
  const [error, setError] = useState<AudioRecordingError | null>(null);
  const start = useCallback(async () => {
    setError(unsupportedError);
    return false;
  }, []);
  const clear = useCallback(async () => setError(null), []);

  return {
    status: error ? "unsupported" : "idle",
    durationMs: 0,
    recording: null,
    error,
    start,
    stop: async () => null,
    cancel: clear,
    clear,
  };
}
