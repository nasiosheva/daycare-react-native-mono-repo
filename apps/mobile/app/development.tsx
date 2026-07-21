import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { developmentCategories, type DevelopmentCategory, can } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useCreateDevelopmentEntry, useDevelopmentEntries } from "@/development/useDevelopment";
import { useI18n } from "@/i18n/I18nProvider";
import { developmentCategoryKey } from "@/i18n/translations";

export default function DevelopmentScreen() {
  const { profile, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const children = useChildren();
  const [childId, setChildId] = useState<string | null>(null);
  const [category, setCategory] = useState<DevelopmentCategory>("OBSERVATION");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const selectedChild = useMemo(() => children.data?.find((child) => child.id === childId) ?? null, [children.data, childId]);
  const entries = useDevelopmentEntries(childId);
  const createEntry = useCreateDevelopmentEntry(childId);
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canRecord = membership ? can(membership.role, "recordDevelopment") && membership.active : false;

  useEffect(() => { if (!childId && children.data?.[0]) setChildId(children.data[0].id); }, [childId, children.data]);

  const submit = async () => {
    try {
      await createEntry.mutateAsync({ category, title, content });
      setTitle("");
      setContent("");
      Alert.alert(t("development.saved"), t("development.savedDescription"));
    } catch (error) {
      Alert.alert(t("development.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  return <AppScreen>
    <AppText variant="title">{t("development.title")}</AppText>
    <AppText tone="muted">{t("development.subtitle")}</AppText>
    {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <View style={styles.selector}>
      {children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}
    </View>
    {selectedChild && canRecord && <View style={styles.form}>
      <AppText variant="heading">{t("development.record", { name: selectedChild.fullName })}</AppText>
      <View style={styles.selector}>{developmentCategories.map((item) => <Button key={item} variant={item === category ? "primary" : "secondary"} onPress={() => setCategory(item)}>{t(developmentCategoryKey(item))}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("development.shortTitle")} value={title} onChangeText={setTitle} maxLength={120} />
      <TextInput style={[styles.input, styles.contentInput]} placeholder={t("development.note")} value={content} onChangeText={setContent} multiline maxLength={2_000} textAlignVertical="top" />
      <Button loading={createEntry.isPending} disabled={!title.trim() || !content.trim()} onPress={() => void submit()}>{t("development.share")}</Button>
    </View>}
    <AppText variant="heading">{t("development.history")}</AppText>
    {entries.isLoading && <AppText>{t("development.loading")}</AppText>}
    {entries.isError && <Button onPress={() => entries.refetch()}>{t("common.retry")}</Button>}
    {entries.data?.map((entry) => <View key={entry.id} style={styles.entry}>
      <AppText variant="label">{t(developmentCategoryKey(entry.category))} · {entry.title}</AppText>
      <AppText>{entry.content}</AppText>
      <AppText variant="caption" tone="muted">{formatDateTime(entry.recordedAt)} · {entry.recordedBy}</AppText>
    </View>)}
    {selectedChild && !entries.isLoading && entries.data?.length === 0 && <AppText tone="muted">{t("development.empty")}</AppText>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  selector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface },
  contentInput: { minHeight: 120, paddingTop: 12 },
  entry: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
