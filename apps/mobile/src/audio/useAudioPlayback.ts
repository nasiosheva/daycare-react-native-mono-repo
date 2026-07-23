import { useCallback, useMemo } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { AudioPlaybackController, AudioPlaybackStatus } from "./types";

const STATUS_UPDATE_INTERVAL_MS = 200;

export function useAudioPlayback(uri: string | null): AudioPlaybackController {
  const player = useAudioPlayer(uri, STATUS_UPDATE_INTERVAL_MS);
  const playerStatus = useAudioPlayerStatus(player);

  const status: AudioPlaybackStatus = useMemo(() => {
    if (!uri) return "idle";
    if (!playerStatus.isLoaded) return "loading";
    if (playerStatus.playing) return "playing";
    if (playerStatus.didJustFinish) return "finished";
    return "paused";
  }, [uri, playerStatus.isLoaded, playerStatus.playing, playerStatus.didJustFinish]);

  const play = useCallback(() => {
    if (playerStatus.didJustFinish) player.seekTo(0);
    player.play();
  }, [player, playerStatus.didJustFinish]);

  const pause = useCallback(() => player.pause(), [player]);

  const seekTo = useCallback((positionMs: number) => {
    void player.seekTo(positionMs / 1000);
  }, [player]);

  return {
    status,
    positionMs: Math.round(playerStatus.currentTime * 1000),
    durationMs: Math.round(playerStatus.duration * 1000),
    isBuffering: playerStatus.isBuffering,
    play,
    pause,
    seekTo,
  };
}
