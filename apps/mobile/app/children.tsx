import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import type { ChildListFilter } from "@daycare/api-client";
import type { ChildGender } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, colors, radius, spacing } from "@daycare/ui";
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

export default function ChildrenScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const canManage = isStaffAdmin && membership.active;
  const canOpenDetail = membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF";
  const [filterVisible, setFilterVisible] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [childFilter, setChildFilter] = useState<ChildListFilter>({});
  const children = useChildren(isStaffAdmin ? childFilter : {});
  const createChild = useCreateChild();
  const [addVisible, setAddVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nisn, setNisn] = useState("");
  const [gender, setGender] = useState<ChildGender>();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const closeAddChild = () => {
    setAddVisible(false);
    setFirstName("");
    setLastName("");
    setNisn("");
    setGender(undefined);
    setDateOfBirth("");
  };
  const saveChild = async () => {
    if (!firstName.trim() || !gender || !isIsoDate(dateOfBirth)) return Alert.alert(t("children.required"));
    try {
      await createChild.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, gender, dateOfBirth });
      closeAddChild();
      Alert.alert(t("children.created"));
    } catch (error) { Alert.alert(t("children.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const openChild = (childId: string) => { setListOpen(false); router.push({ pathname: "/child-detail", params: { childId } }); };
  return <AppScreen showBottomNavigation={false} title={t("children.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {isStaffAdmin && <View style={styles.actions}><Button variant="secondary" onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>{canManage && <Button onPress={() => setAddVisible(true)}>{t("children.add")}</Button>}</View>}
    {canOpenDetail && <ChildrenReportActions filter={childFilter} />}
    {isStaffAdmin && (childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId) && <AppText tone="muted">{t("children.filterActive")}</AppText>}
    <NavigationCard accessibilityLabel={t("children.title")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("children.title")}</AppText>
      <AppText variant="bodySmall" tone="muted">{t("children.menuDescription")}</AppText>
      <AppText tone={children.data?.length ? "default" : "muted"}>{children.isLoading ? t("common.loading") : children.data?.length ? t("children.countSummary", { count: children.data.length }) : t("children.empty")}</AppText>
    </NavigationCard>
    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("children.title")}>
      {children.data?.map((child) => <View key={child.id} style={styles.card}><AppText variant="h5">{child.fullName}</AppText><AppText tone="muted">{child.dateOfBirth}</AppText>{canOpenDetail && <Button variant="secondary" onPress={() => openChild(child.id)}>{t(canManage ? "children.edit" : "children.view")}</Button>}</View>)}
      {!children.isLoading && children.data?.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
    </BottomSheet>
    <BottomSheet
      visible={addVisible}
      onClose={closeAddChild}
      closeAccessibilityLabel={t("common.close")}
      title={t("children.add")}
      negativeAction={{ label: t("common.cancel"), onPress: closeAddChild }}
      positiveAction={{ label: t("children.save"), loading: createChild.isPending, disabled: !firstName.trim() || !gender || !dateOfBirth.trim(), onPress: () => void saveChild() }}
    >
      <TextInput style={styles.input} placeholder={t("children.firstName")} value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder={t("children.lastName")} value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("children.nisn")} value={nisn} onChangeText={setNisn} />
      <GenderPicker value={gender} onChange={setGender} />
      <DatePicker placeholder={t("children.birthDate")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} />
    </BottomSheet>
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} />}
  </AppScreen>;
}

const styles = StyleSheet.create({ actions: { flexDirection: "row", gap: spacing.sm }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface } });
