import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Badge, FloatingActionButton } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";

/** Shared chat floating action with the unread badge used by Parent and Staff entry points. */
export function ChatFloatingAction({ label, unreadCount, onPress }: { label: string; unreadCount: number; onPress: () => void }) {
  const { t } = useI18n();
  return <View style={styles.container}>
    <FloatingActionButton icon="chatbubbles-outline" accessibilityLabel={unreadCount > 0 ? t("childMessage.unreadCount", { count: unreadCount }) : label} onPress={onPress}>{label}</FloatingActionButton>
    {unreadCount > 0 && <ChatUnreadBadge count={unreadCount} style={styles.badge} />}
  </View>;
}

export function ChatUnreadBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  return <Badge tone="danger" icon="chatbubble-ellipses-outline" label={String(count)} style={style} />;
}

const styles = StyleSheet.create({
  container: { position: "relative" },
  badge: { position: "absolute", top: -6, right: -6, zIndex: 1 },
});
