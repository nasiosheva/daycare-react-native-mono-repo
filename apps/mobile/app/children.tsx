import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Child, ChildGuardianStatus, ChildListFilter } from "@daycare/api-client";
import type { ChildGender } from "@daycare/core";
import { AppText, Avatar, Badge, BackButton, BottomSheet, Button, Card, EmptyState, ErrorState, FloatingActionButton, NavigationCard, SearchField, ShimmerList, TextField, colors, spacing, type Tone } from "@daycare/ui";
import { matchesQuery } from "@/attendance/attendanceRoster";
import { notify } from "@/notify/notify";
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
  const [search, setSearch] = useState("");
  const visibleChildren = useMemo(() => children.data?.filter((child) => matchesQuery(child.fullName, search)) ?? [], [children.data, search]);
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
    if (!firstName.trim() || !gender || !isIsoDate(dateOfBirth)) return notify(t("children.required"), undefined, "warning");
    try {
      const parentIdentifier = guardianIdentifier.trim();
      const child = await createChild.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, gender, dateOfBirth });
      closeAddChild();
      if (parentIdentifier) {
        try { await api.bindChildGuardian(child.id, parentIdentifier); notify(t("children.created"), undefined, "success"); }
        catch (error) { notify(t("children.created"), t("children.guardianBindFailed") + (error instanceof Error ? ` ${error.message}` : ""), "warning"); }
      } else notify(t("children.created"), undefined, "success");
    } catch (error) { notify(t("children.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); }
  };
  const openChild = (childId: string) => router.push({ pathname: "/child-detail", params: { childId} });
  return <AppScreen showBottomNavigation={isStaffAdmin} title={isStaffAdmin ? undefined : t("children.title")} header={isStaffAdmin ? undefined : <BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("children.add")} onPress={() => setAddVisible(true)}>{t("children.add")}</FloatingActionButton> : undefined}>
    {isStaffAdmin && <AppText variant="title">{t("children.title")}</AppText>}
    <AppText variant="bodySmall" tone="muted">{t("children.menuDescription")}</AppText>
    <View style={styles.searchRow}>
      <SearchField containerStyle={styles.grow} accessibilityLabel={t("attendance.searchChild")} placeholder={t("attendance.searchChild")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} />
      {isStaffAdmin && <Button variant={hasActiveChildFilter ? "primary" : "secondary"} accessibilityLabel={t(hasActiveChildFilter ? "children.filterActive" : "children.filter")} leadingIcon={<Ionicons name="options-outline" size={18} color={hasActiveChildFilter ? colors.onPrimary : colors.primary} />} onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}
    </View>
    {canOpenDetail && <ChildrenReportActions canExport={canExport} filter={childFilter} />}
    {!children.isFetching && Boolean(children.data?.length) && <AppText variant="label">{t("children.countSummary", { count: children.data!.length })}</AppText>}
    {children.isError && !children.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void children.refetch()} />}
    {!children.isFetching && !children.isError && children.data?.length === 0 && <EmptyState icon="happy-outline" title={t("children.empty")} action={canManage ? { label: t("children.add"), onPress: () => setAddVisible(true) } : undefined} />}
    {!children.isFetching && Boolean(children.data?.length) && visibleChildren.length === 0 && <EmptyState compact icon="search-outline" title={t("common.noResults")} />}
    {children.isFetching ? <ShimmerList /> : visibleChildren.map((child) => <ChildListItem key={child.id} child={child} canOpenDetail={canOpenDetail} showGuardianStatus={isStaffAdmin} accessibilityLabel={t("children.view")} guardianStatusLabel={(status) => guardianStatusLabel(status, t)} onPress={() => openChild(child.id)} />)}
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} showGuardianStatus />}
    <BottomSheet
      visible={addVisible}
      onClose={closeAddChild}
      closeAccessibilityLabel={t("common.close")}
      title={t("children.add")}
      negativeAction={{ label: t("common.cancel"), onPress: closeAddChild }}
      positiveAction={{ label: t("children.save"), loading: createChild.isPending, disabled: !firstName.trim() || !gender || !dateOfBirth.trim(), onPress: () => void saveChild() }}
    >
      <TextField label={t("children.firstName")} required autoCapitalize="words" value={firstName} onChangeText={(value) => setFirstName(capitalizeWords(value))} />
      <TextField label={t("children.lastName")} autoCapitalize="words" value={lastName} onChangeText={(value) => setLastName(capitalizeWords(value))} />
      <TextField label={t("children.nisn")} inputMode="numeric" value={nisn} onChangeText={setNisn} />
      <GenderPicker value={gender} onChange={setGender} />
      <View style={styles.field}><AppText variant="label">{t("children.birthDate")} <AppText variant="label" tone="danger">*</AppText></AppText><DatePicker placeholder={t("children.birthDate")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} /></View>
      <TextField label={t("children.guardianIdentifier")} leadingIcon="person-add-outline" hint={t("children.guardianIdentifierInfo")} autoCapitalize="none" autoCorrect={false} placeholder={t("children.guardianIdentifierOptional")} value={guardianIdentifier} onChangeText={setGuardianIdentifier} />
    </BottomSheet>
  </AppScreen>;
}

const guardianTones: Record<ChildGuardianStatus, Tone> = { LINKED: "success", UNLINKED: "neutral", REVIEW_REQUIRED: "danger" };

function ChildListItem({ child, canOpenDetail, showGuardianStatus, accessibilityLabel, guardianStatusLabel, onPress }: { child: Child; canOpenDetail: boolean; showGuardianStatus: boolean; accessibilityLabel: string; guardianStatusLabel: (status: ChildGuardianStatus) => string; onPress: () => void }) {
  const content = <View style={styles.childBody}><AppText variant="h6">{child.fullName}</AppText><AppText variant="bodySmall" tone="muted">{child.dateOfBirth}</AppText>{showGuardianStatus && child.guardianStatus && <Badge tone={guardianTones[child.guardianStatus]} label={guardianStatusLabel(child.guardianStatus)} />}</View>;
  if (!canOpenDetail) return <Card><View style={styles.childRow}><Avatar name={child.fullName} />{content}</View></Card>;
  return <NavigationCard accessibilityLabel={`${accessibilityLabel}: ${child.fullName}`} onPress={onPress} leading={<Avatar name={child.fullName} />}>{content}</NavigationCard>;
}

function guardianStatusLabel(status: ChildGuardianStatus, t: ReturnType<typeof useI18n>["t"]) {
  switch (status) {
    case "LINKED": return t("children.guardianStatus.LINKED");
    case "UNLINKED": return t("children.guardianStatus.UNLINKED");
    case "REVIEW_REQUIRED": return t("children.guardianStatus.REVIEW_REQUIRED");
  }
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  field: { gap: spacing.xs },
  childRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  childBody: { flex: 1, gap: spacing.xs },
});
