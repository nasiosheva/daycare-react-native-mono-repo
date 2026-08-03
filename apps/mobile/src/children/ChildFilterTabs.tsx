import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { ChildGuardianStatus, ChildListFilter } from "@daycare/api-client";
import { AppText, colors, spacing } from "@daycare/ui";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { hasLegacyLearningAccess, useUiAccessContext } from "@/education/useUiAccessContext";

type ChildFilterTabsProps = {
  filter: ChildListFilter;
  onChange: (filter: ChildListFilter) => void;
  enabled?: boolean;
  showGuardianStatus?: boolean;
};

export function ChildFilterTabs({ filter, onChange, enabled = true, showGuardianStatus = false }: ChildFilterTabsProps) {
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(enabled && Boolean(membership));
  const canAccessLegacyClasses = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: enabled && Boolean(organizationId) });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: enabled && canAccessLegacyClasses });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: enabled && canAccessLegacyClasses });
  const filteredClassrooms = useMemo(() => classrooms.data?.filter((classroom) => classroom.active && (!filter.branchId || classroom.branchId === filter.branchId) && (!filter.learningLevelId || classroom.learningLevelId === filter.learningLevelId)) ?? [], [classrooms.data, filter.branchId, filter.learningLevelId]);
  const selectBranch = (branchId?: string) => onChange({ branchId, guardianStatus: filter.guardianStatus });
  const selectLevel = (learningLevelId?: string) => onChange({ branchId: filter.branchId, learningLevelId, guardianStatus: filter.guardianStatus });
  const selectClassroom = (classroomId?: string) => onChange({ branchId: filter.branchId, learningLevelId: filter.learningLevelId, classroomId, guardianStatus: filter.guardianStatus });
  const selectGuardianStatus = (guardianStatus?: ChildGuardianStatus) => onChange({ ...filter, guardianStatus });
  useEffect(() => {
    if (!access.isLoading && !canAccessLegacyClasses && (filter.learningLevelId || filter.classroomId)) onChange({ branchId: filter.branchId, guardianStatus: filter.guardianStatus });
  }, [access.isLoading, canAccessLegacyClasses, filter.branchId, filter.classroomId, filter.guardianStatus, filter.learningLevelId, onChange]);

  return <View style={styles.container}>
    <FilterTabGroup label={t("children.filterBranch")}>
      <FilterTab label={t("children.allBranches")} selected={!filter.branchId} onPress={() => selectBranch()} />
      {branches.data?.map((branch) => <FilterTab key={branch.id} label={branch.name} selected={filter.branchId === branch.id} onPress={() => selectBranch(branch.id)} />)}
    </FilterTabGroup>
    {showGuardianStatus && <FilterTabGroup label={t("children.filterGuardianStatus")}>
      <FilterTab label={t("children.allGuardianStatuses")} selected={!filter.guardianStatus} onPress={() => selectGuardianStatus()} />
      <FilterTab label={t("children.guardianStatus.LINKED")} selected={filter.guardianStatus === "LINKED"} onPress={() => selectGuardianStatus("LINKED")} />
      <FilterTab label={t("children.guardianStatus.UNLINKED")} selected={filter.guardianStatus === "UNLINKED"} onPress={() => selectGuardianStatus("UNLINKED")} />
      <FilterTab label={t("children.guardianStatus.REVIEW_REQUIRED")} selected={filter.guardianStatus === "REVIEW_REQUIRED"} onPress={() => selectGuardianStatus("REVIEW_REQUIRED")} />
    </FilterTabGroup>}
    {canAccessLegacyClasses && <>
      <FilterTabGroup label={t("children.filterLevel")}>
        <FilterTab label={t("children.allLevels")} selected={!filter.learningLevelId} onPress={() => selectLevel()} />
        {levels.data?.filter((level) => level.active).map((level) => <FilterTab key={level.id} label={level.name} selected={filter.learningLevelId === level.id} onPress={() => selectLevel(level.id)} />)}
      </FilterTabGroup>
      <FilterTabGroup label={t("children.filterClassroom")}>
        <FilterTab label={t("children.allClassrooms")} selected={!filter.classroomId} onPress={() => selectClassroom()} />
        {filteredClassrooms.map((classroom) => <FilterTab key={classroom.id} label={classroom.name} selected={filter.classroomId === classroom.id} onPress={() => selectClassroom(classroom.id)} />)}
      </FilterTabGroup>
    </>}
  </View>;
}

function FilterTabGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.group}><AppText variant="label">{label}</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{children}</ScrollView></View>;
}

function FilterTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tab, selected && styles.activeTab, pressed && styles.pressedTab]}><AppText variant="label" style={selected ? styles.activeTabText : styles.tabText}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({ container: { gap: spacing.sm }, group: { gap: spacing.xs }, tabs: { gap: spacing.md, paddingRight: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" }, activeTab: { borderBottomColor: colors.primary }, tabText: { color: colors.muted }, activeTabText: { color: colors.primary }, pressedTab: { opacity: 0.72 } });
