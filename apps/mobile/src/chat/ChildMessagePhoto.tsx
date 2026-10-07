import { useState } from "react";
import { Image, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText, BottomSheet, ShimmerList, colors, radius } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export const childMessagePhotoQueryKey = (organizationId: string | undefined, childId: string, messageId: string) => ["child-message-photo", organizationId, childId, messageId] as const;

/**
 * Lazily loads one chat message photo inside its bubble; tapping opens it full
 * size. Photos never change after sending, so the cached bytes stay fresh.
 */
export function ChildMessagePhoto({ childId, messageId, organizationId }: { childId: string; messageId: string; organizationId?: string }) {
  const { api } = useAuth();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const photo = useQuery({
    queryKey: childMessagePhotoQueryKey(organizationId, childId, messageId),
    queryFn: () => api.childMessagePhoto(childId, messageId, organizationId),
    staleTime: Infinity,
  });
  const uri = photo.data ? `data:${photo.data.contentType};base64,${photo.data.dataBase64}` : null;
  if (photo.isLoading) return <ShimmerList variant="tile" />;
  if (!uri) return <AppText variant="caption" tone="danger">{t("childMessage.photoLoadFailed")}</AppText>;
  return <>
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={t("childMessage.viewPhoto")} onPress={(event) => { event.stopPropagation(); setExpanded(true); }}>
      <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
    </Pressable>
    <BottomSheet visible={expanded} onClose={() => setExpanded(false)} closeAccessibilityLabel={t("common.close")} title={t("childMessage.photo")}>
      <Image source={{ uri }} style={styles.full} resizeMode="contain" />
    </BottomSheet>
  </>;
}

const styles = StyleSheet.create({
  thumbnail: { width: 200, height: 150, borderRadius: radius.md, backgroundColor: colors.surface },
  full: { width: "100%", height: 360, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
