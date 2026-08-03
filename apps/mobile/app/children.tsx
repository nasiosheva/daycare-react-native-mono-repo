import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import type { Child, ChildGuardianStatus, ChildListFilter } from "@daycare/api-client";
import type { ChildGender } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren } from "@/attendance/useAttendance";
import { useCreateChild } from "@/children/useChildManagement";
import { GenderPicker } from "@/children/GenderPicker";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";
import { ChildrenReportActions } from "@/document-export/ChildrenReportActions";
import { ChildFilterSheet } from "@/children/ChildFilterSheet";
import { capitalizeWords } from "@/text/capitalizeWords";

export default function ChildrenScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { api, profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const canManage = isStaffAdmin && membership.active;
  const canOpenDetail = membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF";
  const canExport = Boolean(membership?.active && canOpenDetail);
  const [childFilter, setChildFilter] = useState<ChildListFilter>({});
  const [filterVisible, setFilterVisible] = useState(false);
  const hasActiveChildFilter = Boolean(childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId || childFilter.guardianStatus);
  const children = useChildren(isStaffAdmin ? childFilter : {});
  const createChild = useCreateChild();
  const [addVisible, setAddVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nisn, setNisn] = useState("");
  const [gender, setGender] = useState<ChildGender>();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianIdentifier, setGuardianIdentifier] = useState("");
  const closeAddChild = () => {
    setAddVisible(false);
    setFirstName("");
    setLastName("");
    setNisn("");
    setGender(undefined);
    setDateOfBirth("");
    setGuardianIdentifier("");
  };
  const saveChild = async () => {
    if (!firstName.trim() || !gender || !isIsoDate(dateOfBirth)) return Alert.alert(t("children.required"));
    try {
      const parentIdentifier = guardianIdentifier.trim();
      const child = await createChild.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, gender, dateOfBirth });
      closeAddChild();
      if (parentIdentifier) {
        try { await api.bindChildGuardian(child.id, parentIdentifier); Alert.alert(t("children.created")); }
        catch (error) { Alert.alert(t("children.created"), t("children.guardianBindFailed") + (error instanceof Error ? ` ${error.message}` : "")); }
      } else Alert.alert(t("children.created"));
    } catch (error) { Alert.alert(t("children.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const openChild = (childId: string) => router.push({ pathname: "/child-detail", params: { childId} });
  return <AppScreen showBottomNavigation={false} title={t("children.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton accessibilityLabel={t("children.add")} onPress={() => setAddVisible(true)}>+ {t("children.add")}</FloatingActionButton> : undefined}>
    {isStaffAdmin && <Button variant="secondary" onPress={() => setFilterVisible(true)}>{t(hasActiveChildFilter ? "children.filterActive" : "children.filter")}</Button>}
    {canOpenDetail && <ChildrenReportActions canExport={canExport} filter={childFilter} />}
    <AppText variant="bodySmall" tone="muted">{t("children.menuDescription")}</AppText>
    <AppText tone={children.data?.length ? "default" : "muted"}>{children.isFetching ? t("common.loading") : children.data?.length ? t("children.countSummary", { count: children.data.length }) : t("children.empty")}</AppText>
    {children.isError && <Button variant="secondary" onPress={() => void children.refetch()}>{t("common.retry")}</Button>}
    {children.isFetching ? <ShimmerList /> : children.data?.map((child) => <ChildListItem key={child.id} child={child} canOpenDetail={canOpenDetail} showGuardianStatus={isStaffAdmin} accessibilityLabel={t("children.view")} guardianStatusLabel={(status) => guardianStatusLabel(status, t)} onPress={() => openChild(child.id)} />)}
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} showGuardianStatus />}
    <BottomSheet
      visible={addVisible}
      onClose={closeAddChild}
      closeAccessibilityLabel={t("common.close")}
      title={t("children.add")}
      negativeAction={{ label: t("common.cancel"), onPress: closeAddChild }}
      positiveAction={{ label: t("children.save"), loading: createChild.isPending, disabled: !firstName.trim() || !gender || !dateOfBirth.trim(), onPress: () => void saveChild() }}
    >
      <TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.firstName")} value={firstName} onChangeText={(value) => setFirstName(capitalizeWords(value))} />
      <TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.lastName")} value={lastName} onChangeText={(value) => setLastName(capitalizeWords(value))} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("children.nisn")} value={nisn} onChangeText={setNisn} />
      <GenderPicker value={gender} onChange={setGender} />
      <DatePicker placeholder={t("children.birthDate")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} />
      <AppText variant="label">{t("children.guardianIdentifier")}</AppText>
      <TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} placeholder={t("children.guardianIdentifierOptional")} value={guardianIdentifier} onChangeText={setGuardianIdentifier} />
      <AppText variant="caption" tone="muted">{t("children.guardianIdentifierInfo")}</AppText>
    </BottomSheet>
  </AppScreen>;
}

function ChildListItem({ child, canOpenDetail, showGuardianStatus, accessibilityLabel, guardianStatusLabel, onPress }: { child: Child; canOpenDetail: boolean; showGuardianStatus: boolean; accessibilityLabel: string; guardianStatusLabel: (status: ChildGuardianStatus) => string; onPress: () => void }) {
  const content = <><AppText variant="h5">{child.fullName}</AppText><AppText tone="muted">{child.dateOfBirth}</AppText>{showGuardianStatus && child.guardianStatus && <View style={[styles.guardianBadge, child.guardianStatus === "LINKED" ? styles.guardianBadgeLinked : child.guardianStatus === "REVIEW_REQUIRED" ? styles.guardianBadgeReview : styles.guardianBadgeUnlinked]}><AppText variant="caption" style={child.guardianStatus === "REVIEW_REQUIRED" ? styles.guardianBadgeReviewText : styles.guardianBadgeText}>{guardianStatusLabel(child.guardianStatus)}</AppText></View>}</>;
  if (!canOpenDetail) return <View style={styles.card}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${accessibilityLabel}: ${child.fullName}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>{content}</Pressable>;
}

function guardianStatusLabel(status: ChildGuardianStatus, t: ReturnType<typeof useI18n>["t"]) {
  switch (status) {
    case "LINKED": return t("children.guardianStatus.LINKED");
    case "UNLINKED": return t("children.guardianStatus.UNLINKED");
    case "REVIEW_REQUIRED": return t("children.guardianStatus.REVIEW_REQUIRED");
  }
}

const styles = StyleSheet.create({ card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, cardPressed: { opacity: 0.72 }, guardianBadge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, guardianBadgeLinked: { backgroundColor: colors.accentSoft }, guardianBadgeUnlinked: { backgroundColor: colors.surfaceTint, borderWidth: 1, borderColor: colors.border }, guardianBadgeReview: { backgroundColor: colors.dangerSoft }, guardianBadgeText: { color: colors.text }, guardianBadgeReviewText: { color: colors.danger }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface } });
