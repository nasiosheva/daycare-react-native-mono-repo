import { useCallback, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./theme";

export type AudioPlayerStatus = "idle" | "loading" | "playing" | "paused" | "finished" | "error";

type Props = {
  status: AudioPlayerStatus;
  positionMs: number;
  durationMs: number;
  isBuffering?: boolean;
  onPlayPause: () => void;
  onSeek: (positionMs: number) => void;
  playAccessibilityLabel: string;
  pauseAccessibilityLabel: string;
  seekAccessibilityLabel: string;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ status, positionMs, durationMs, isBuffering, onPlayPause, onSeek, playAccessibilityLabel, pauseAccessibilityLabel, seekAccessibilityLabel }: Props) {
  const [draggingRatio, setDraggingRatio] = useState<number | null>(null);
  const trackWidthRef = useRef(0);
  const durationRef = useRef(durationMs);
  durationRef.current = durationMs;

  const ratioFromEvent = useCallback((event: GestureResponderEvent) => {
    const width = trackWidthRef.current;
    if (width <= 0) return 0;
    return Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => durationRef.current > 0,
      onMoveShouldSetPanResponder: () => durationRef.current > 0,
      onPanResponderGrant: (event) => setDraggingRatio(ratioFromEvent(event)),
      onPanResponderMove: (event) => setDraggingRatio(ratioFromEvent(event)),
      onPanResponderRelease: (event) => {
        const ratio = ratioFromEvent(event);
        setDraggingRatio(null);
        onSeek(Math.round(ratio * durationRef.current));
      },
      onPanResponderTerminate: () => setDraggingRatio(null),
    }),
  ).current;

  const progressRatio = draggingRatio ?? (durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0);
  const isPlaying = status === "playing";
  const isDisabled = status === "loading" || status === "error";

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? pauseAccessibilityLabel : playAccessibilityLabel}
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPlayPause}
        style={({ pressed }) => [styles.playButton, isDisabled && styles.playButtonDisabled, pressed && !isDisabled && styles.pressed]}
      >
        <AppText variant="label" style={styles.playIcon}>{isPlaying ? "❙❙" : "▶"}</AppText>
      </Pressable>
      <View style={styles.trackArea}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={seekAccessibilityLabel}
          accessibilityValue={{ min: 0, max: Math.round(durationMs / 1000), now: Math.round(positionMs / 1000) }}
          style={styles.track}
          onLayout={(event) => { trackWidthRef.current = event.nativeEvent.layout.width; }}
          {...panResponder.panHandlers}
        >
          <View style={styles.trackBackground} />
          <View style={[styles.trackFill, { width: `${progressRatio * 100}%` }]} />
          <View style={[styles.thumb, { left: `${progressRatio * 100}%` }]} />
        </View>
        <AppText variant="caption" tone="muted">{formatDuration(positionMs)} / {formatDuration(durationMs)}{isBuffering ? "…" : ""}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playButton: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  playButtonDisabled: { backgroundColor: colors.disabled },
  playIcon: { color: colors.onPrimary },
  pressed: { opacity: 0.82 },
  trackArea: { flex: 1, gap: spacing.xs },
  track: { height: 20, justifyContent: "center" },
  trackBackground: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  trackFill: { position: "absolute", left: 0, height: 4, borderRadius: radius.pill, backgroundColor: colors.primary },
  thumb: { position: "absolute", width: 14, height: 14, marginLeft: -7, borderRadius: radius.pill, backgroundColor: colors.primary },
});
