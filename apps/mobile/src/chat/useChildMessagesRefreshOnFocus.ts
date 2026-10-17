// Mories Deo Hutapea,S.E.,S.Kom
import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

/** Refresh a thread when a previously focused screen or foreground app resumes. */
export function useChildMessagesRefreshOnFocus(refetch: () => Promise<unknown>, enabled = true): void {
  const hasFocusedOnce = useRef(false);

  useFocusEffect(useCallback(() => {
    if (!enabled) return undefined;
    if (hasFocusedOnce.current) void refetch();
    hasFocusedOnce.current = true;

    let wasInactive = AppState.currentState !== "active";
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        wasInactive = true;
      } else if (wasInactive) {
        wasInactive = false;
        void refetch();
      }
    });

    return () => subscription.remove();
  }, [enabled, refetch]));
}
