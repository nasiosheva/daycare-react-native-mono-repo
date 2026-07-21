import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as FileSystem from "expo-file-system";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import {
  type AudioRecording,
  type AudioRecordingController,
  type AudioRecordingError,
  type AudioRecordingErrorCode,
  type AudioRecordingStatus,
  AUDIO_RECORDING_MAX_DURATION_MS,
  createAudioRecording,
} from "./types";

const MAX_DURATION_SECONDS = AUDIO_RECORDING_MAX_DURATION_MS / 1000;

function toError(code: AudioRecordingErrorCode, error?: unknown): AudioRecordingError {
  return { code, message: error instanceof Error ? error.message : "Audio recording is unavailable." };
}

export function useAudioRecording(): AudioRecordingController {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [status, setStatus] = useState<AudioRecordingStatus>("idle");
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [error, setError] = useState<AudioRecordingError | null>(null);
  const completedUri = useRef<string | null>(null);
  const cancelledUri = useRef<string | null>(null);
  const hasStartedRecording = useRef(false);

  const complete = useCallback(async (uri: string | null): Promise<AudioRecording | null> => {
    if (!uri || cancelledUri.current === uri) return null;
    if (completedUri.current === uri) return recording;

    completedUri.current = uri;
    const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
    const fileSizeBytes = fileInfo.exists && "size" in fileInfo ? fileInfo.size : undefined;
    const nextRecording = createAudioRecording(uri, recorder.getStatus().durationMillis, new Date(), fileSizeBytes);
    setRecording(nextRecording);
    setError(null);
    setStatus("completed");
    return nextRecording;
  }, [recorder, recording]);

  const stop = useCallback(async (): Promise<AudioRecording | null> => {
    if (!recorder.isRecording) return recording;

    try {
      await recorder.stop();
      return await complete(recorder.uri);
    } catch (nextError) {
      setError(toError("recording_failed", nextError));
      setStatus("error");
      return null;
    }
  }, [complete, recorder, recording]);

  const deleteUri = useCallback(async (uri: string | null) => {
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
  }, []);

  const cancel = useCallback(async () => {
    const activeUri = recorder.uri;
    try {
      if (recorder.isRecording) await recorder.stop();
      const uri = recorder.uri ?? activeUri;
      cancelledUri.current = uri;
      await deleteUri(uri);
      completedUri.current = null;
      setRecording(null);
      setError(null);
      setStatus("idle");
    } catch (nextError) {
      setError(toError("recording_failed", nextError));
      setStatus("error");
    }
  }, [deleteUri, recorder]);

  const clear = useCallback(async () => {
    await deleteUri(recording?.uri ?? null);
    completedUri.current = null;
    setRecording(null);
    setError(null);
    setStatus("idle");
  }, [deleteUri, recording]);

  const start = useCallback(async (): Promise<boolean> => {
    if (recorder.isRecording) return true;
    if (recording) {
      setError(toError("recording_failed", new Error("Clear the completed recording before starting a new one.")));
      return false;
    }

    setStatus("requesting_permission");
    setError(null);
    cancelledUri.current = null;
    completedUri.current = null;
    hasStartedRecording.current = false;
    setRecording(null);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(toError("permission_denied", new Error("Microphone permission was denied.")));
        setStatus("error");
        return false;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        interruptionMode: "doNotMix",
        interruptionModeAndroid: "doNotMix",
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      recorder.recordForDuration(MAX_DURATION_SECONDS);
      setStatus("recording");
      return true;
    } catch (nextError) {
      setError(toError("recording_failed", nextError));
      setStatus("error");
      return false;
    }
  }, [recorder, recording]);

  useEffect(() => {
    if (status !== "recording") return;

    if (recorderState.isRecording) {
      hasStartedRecording.current = true;
      return;
    }

    if (hasStartedRecording.current) {
      void complete(recorder.uri).catch((nextError) => {
        setError(toError("recording_failed", nextError));
        setStatus("error");
      });
    }
  }, [complete, recorder.uri, recorderState.isRecording, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active" && recorder.isRecording) void stop();
    });
    return () => subscription.remove();
  }, [recorder, stop]);

  useEffect(() => {
    if (recorderState.mediaServicesDidReset) {
      setError(toError("recording_failed", new Error("Audio services were reset.")));
      setStatus("error");
    }
  }, [recorderState.mediaServicesDidReset]);

  return { status, durationMs: recorderState.durationMillis, recording, error, start, stop, cancel, clear };
}
