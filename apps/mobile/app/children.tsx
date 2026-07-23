import { useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ChildGender } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren } from "@/attendance/useAttendance";
import { useCreateChild } from "@/children/useChildManagement";
import { GenderPicker } from "@/children/GenderPicker";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";

export default function ChildrenScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { api, profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const canOpenDetail = membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF";
  const [filterVisible, setFilterVisible] = useState(false);
  const [branchId, setBranchId] = useState<string>();
  const [learningLevelId, setLearningLevelId] = useState<string>();
  const [classroomId, setClassroomId] = useState<string>();
  const [draftBranchId, setDraftBranchId] = useState<string>();
  const [draftLearningLevelId, setDraftLearningLevelId] = useState<string>();
  const [draftClassroomId, setDraftClassroomId] = useState<string>();
  const childFilter = useMemo(() => ({ branchId, learningLevelId, classroomId }), [branchId, classroomId, learningLevelId]);
  const children = useChildren(childFilter);
  const branches = useQuery({ queryKey: ["learning-branches", organizationId], queryFn: () => api.learningBranches(), enabled: canManage });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: canManage });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: canManage });
  const filteredClassrooms = classrooms.data?.filter((classroom) => classroom.active && (!draftBranchId || classroom.branchId === draftBranchId) && (!draftLearningLevelId || classroom.learningLevelId === draftLearningLevelId)) ?? [];
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
  const openFilters = () => {
    setDraftBranchId(branchId);
    setDraftLearningLevelId(learningLevelId);
    setDraftClassroomId(classroomId);
    setFilterVisible(true);
  };
  const discardFilters = () => {
    setDraftBranchId(branchId);
    setDraftLearningLevelId(learningLevelId);
    setDraftClassroomId(classroomId);
    setFilterVisible(false);
  };
  const clearFilters = () => {
    setDraftBranchId(undefined);
    setDraftLearningLevelId(undefined);
    setDraftClassroomId(undefined);
  };
  const selectBranch = (id?: string) => {
    setDraftBranchId(id);
    setDraftLearningLevelId(undefined);
    setDraftClassroomId(undefined);
  };
  const selectLevel = (id?: string) => {
    setDraftLearningLevelId(id);
    setDraftClassroomId(undefined);
  };
  const applyFilters = () => {
    setBranchId(draftBranchId);
    setLearningLevelId(draftLearningLevelId);
    setClassroomId(draftClassroomId);
    setFilterVisible(false);
  };
  const saveChild = async () => {
    if (!firstName.trim() || !gender || !isIsoDate(dateOfBirth)) return Alert.alert(t("children.required"));
    try {
      await createChild.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, gender, dateOfBirth });
      closeAddChild();
      Alert.alert(t("children.created"));
    } catch (error) { Alert.alert(t("children.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen showBottomNavigation={false} title={t("children.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {canManage && <View style={styles.actions}><Button variant="secondary" onPress={openFilters}>{t("children.filter")}</Button><Button onPress={() => setAddVisible(true)}>{t("children.add")}</Button></View>}
    {canManage && (branchId || learningLevelId || classroomId) && <AppText tone="muted">{t("children.filterActive")}</AppText>}
    {children.data?.map((child) => <View key={child.id} style={styles.card}><AppText variant="h5">{child.fullName}</AppText><AppText tone="muted">{child.dateOfBirth}</AppText>{canOpenDetail && <Button variant="secondary" onPress={() => router.push({ pathname: "/child-detail", params: { childId: child.id } })}>{t(canManage ? "children.edit" : "children.view")}</Button>}</View>)}
    {!children.isLoading && children.data?.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
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
    <BottomSheet
      visible={filterVisible}
      onClose={discardFilters}
      closeAccessibilityLabel={t("common.close")}
      title={t("children.filter")}
      negativeAction={{ label: t("children.clearFilters"), onPress: clearFilters }}
      positiveAction={{ label: t("common.ok"), onPress: applyFilters }}
    >
      <AppText variant="label">{t("children.filterBranch")}</AppText>
      <View style={styles.options}><Button variant={draftBranchId ? "secondary" : "primary"} onPress={() => selectBranch()}>{t("children.allBranches")}</Button>{branches.data?.map((branch) => <Button key={branch.id} variant={draftBranchId === branch.id ? "primary" : "secondary"} onPress={() => selectBranch(branch.id)}>{branch.name}</Button>)}</View>
      <AppText variant="label">{t("children.filterLevel")}</AppText>
      <View style={styles.options}><Button variant={draftLearningLevelId ? "secondary" : "primary"} onPress={() => selectLevel()}>{t("children.allLevels")}</Button>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={draftLearningLevelId === level.id ? "primary" : "secondary"} onPress={() => selectLevel(level.id)}>{level.name}</Button>)}</View>
      <AppText variant="label">{t("children.filterClassroom")}</AppText>
      <View style={styles.options}><Button variant={draftClassroomId ? "secondary" : "primary"} onPress={() => setDraftClassroomId(undefined)}>{t("children.allClassrooms")}</Button>{filteredClassrooms.map((classroom) => <Button key={classroom.id} variant={draftClassroomId === classroom.id ? "primary" : "secondary"} onPress={() => setDraftClassroomId(classroom.id)}>{classroom.name}</Button>)}</View>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ actions: { flexDirection: "row", gap: spacing.sm }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
