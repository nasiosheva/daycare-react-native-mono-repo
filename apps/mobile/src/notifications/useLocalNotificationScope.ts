import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { setActiveLocalNotificationScope } from "./localNotificationContent";

/**
 * Marks the focused screen as the active notification scope, so a feature can
 * skip notifying about what the user is already looking at. Pass null while
 * the screen's identifiers are not resolved yet.
 */
export function useLocalNotificationScope(scopeKey: string | null): void {
  useFocusEffect(useCallback(() => {
    if (!scopeKey) return undefined;
    setActiveLocalNotificationScope(scopeKey);
    return () => setActiveLocalNotificationScope(null);
  }, [scopeKey]));
}
