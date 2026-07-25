import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChildListFilter } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { can } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useCreateDevelopmentEntry, useDevelopmentCategories, useDevelopmentEntries } from "@/development/useDevelopment";
import { groupDevelopmentEntries } from "@/development/history";
import { resolveSelectedChildId } from "@/development/selectedChild";
import { useI18n } from "@/i18n/I18nProvider";
import { ChildFilterSheet } from "@/children/ChildFilterSheet";

export default function DevelopmentScreen() {
  const router = useRouter();
  const { childId: routeChildId } = useLocalSearchParams<{ childId?: string }>();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const hasFixedChild = typeof routeChildId === "string";
  const [filterVisible, setFilterVisible] = useState(false);
  const [childFilter, setChildFilter] = useState<ChildListFilter>({});
  const children = useChildren(isStaffAdmin ? childFilter : {});
  const [childId, setChildId] = useState<string | null>(typeof routeChildId === "string" ? routeChildId : null);
  const [category, setCategory] = useState("OBSERVATION");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [entryVisible, setEntryVisible] = useState(false);
  const selectedChild = useMemo(() => children.data?.find((child) => child.id === childId) ?? null, [children.data, childId]);
  const entries = useDevelopmentEntries(childId);
  const developmentCategories = useDevelopmentCategories();
  const createEntry = useCreateDevelopmentEntry(childId);
  const isOperationalChildScreen = membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF";
  const canRecord = membership ? can(membership.role, "recordDevelopment") && membership.active : false;
  const canManageCategories = membership?.active && (membership.role === "STAFF_ADMIN" || (membership.role === "STAFF" && membership.canManageDevelopmentCategories));

  useEffect(() => {
    setChildId((currentChildId) => resolveSelectedChildId(children.data ?? [], currentChildId, hasFixedChild ? routeChildId : undefined, hasFixedChild));
  }, [children.data, hasFixedChild, routeChildId]);

  useEffect(() => {
    if (!developmentCategories.data?.length) return;
    if (!developmentCategories.data.some((item) => item.id === category && item.active)) setCategory(developmentCategories.data.find((item) => item.active)?.id ?? "OBSERVATION");
  }, [category, developmentCategories.data]);

  const selectChild = (nextChildId: string) => {
    setChildId(nextChildId);
    router.setParams({ childId: nextChildId });
  };

  const submit = async () => {
    try {
      await createEntry.mutateAsync({ category, title, content });
      setTitle("");
      setContent("");
      setEntryVisible(false);
      Alert.alert(t("development.saved"), t("development.savedDescription"));
    } catch (error) {
      Alert.alert(t("development.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  return <AppScreen showBottomNavigation={!isOperationalChildScreen} title={isOperationalChildScreen ? t("development.title") : undefined} header={isOperationalChildScreen ? <BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} /> : undefined}>
    {!isOperationalChildScreen && <AppText variant="title">{t("development.title")}</AppText>}
    <AppText tone="muted">{t("development.subtitle")}</AppText>
    {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {isStaffAdmin && <Button variant="secondary" onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}
    {isStaffAdmin && (childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId) && <AppText tone="muted">{t("children.filterActive")}</AppText>}
    {hasFixedChild && selectedChild && <AppText variant="heading">{selectedChild.fullName}</AppText>}
    {!hasFixedChild && <View style={styles.selector}>
      {children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => selectChild(child.id)}>{child.fullName}</Button>)}
    </View>}
    {hasFixedChild && !children.isLoading && !selectedChild && <AppText tone="muted">{t("children.empty")}</AppText>}
    {selectedChild && <Button variant="secondary" onPress={() => router.push({ pathname: "/goals", params: { childId: selectedChild.id } })}>{t("goals.title")}</Button>}
    {canManageCategories && <Button variant="secondary" onPress={() => router.push("/development-categories")}>{t("development.categories")}</Button>}
    {selectedChild && canRecord && <Button onPress={() => setEntryVisible(true)}>{t("development.record", { name: selectedChild.fullName })}</Button>}
    <BottomSheet visible={entryVisible} onClose={() => setEntryVisible(false)} closeAccessibilityLabel={t("common.close")} title={selectedChild ? t("development.record", { name: selectedChild.fullName }) : t("development.title")} negativeAction={{ label: t("common.cancel"), onPress: () => setEntryVisible(false) }} positiveAction={{ label: t("development.share"), loading: createEntry.isPending, disabled: !title.trim() || !content.trim(), onPress: () => void submit() }}>
      <View style={styles.selector}>{developmentCategories.data?.filter((item) => item.active).map((item) => <Button key={item.id} variant={item.id === category ? "primary" : "secondary"} onPress={() => setCategory(item.id)}>{item.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("development.shortTitle")} value={title} onChangeText={setTitle} maxLength={120} />
      <TextInput style={[styles.input, styles.contentInput]} placeholder={t("development.note")} value={content} onChangeText={setContent} multiline maxLength={2_000} textAlignVertical="top" />
    </BottomSheet>
    {selectedChild && <DevelopmentHistory entries={entries} />}
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} />}
  </AppScreen>;
}

function DevelopmentHistory({ entries }: { entries: ReturnType<typeof useDevelopmentEntries> }) {
  const { t, formatDateTime } = useI18n();
  const groups = groupDevelopmentEntries(entries.data ?? []);
  return <View style={styles.section}>
    <AppText variant="heading">{t("development.history")}</AppText>
    {entries.isFetching && <ShimmerList />}
    {entries.isError && <Button variant="secondary" onPress={() => entries.refetch()}>{t("common.retry")}</Button>}
    {!entries.isFetching && groups.map((group) => <View key={group.category} style={styles.categoryGroup}>
      <AppText variant="label">{group.categoryName}</AppText>
      {group.entries.map((entry) => <View key={entry.id} style={styles.entry}>
        <AppText variant="label">{entry.title}</AppText>
        <AppText>{entry.content}</AppText>
        <AppText variant="caption" tone="muted">{formatDateTime(entry.recordedAt)} · {entry.recordedBy}</AppText>
      </View>)}
    </View>)}
    {!entries.isFetching && entries.data?.length === 0 && <AppText tone="muted">{t("development.empty")}</AppText>}
  </View>;
}

const styles = StyleSheet.create({
  selector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.sm },
  categoryGroup: { gap: spacing.xs },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface },
  contentInput: { minHeight: 120, paddingTop: 12 },
  entry: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
