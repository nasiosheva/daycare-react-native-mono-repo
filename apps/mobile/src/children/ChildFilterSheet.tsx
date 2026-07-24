import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ChildListFilter } from "@daycare/api-client";
import { AppText, BottomSheet, Button, spacing } from "@daycare/ui";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

type ChildFilterSheetProps = {
  visible: boolean;
  filter: ChildListFilter;
  onClose: () => void;
  onApply: (filter: ChildListFilter) => void;
};

export function ChildFilterSheet({ visible, filter, onClose, onApply }: ChildFilterSheetProps) {
  const { api, organizationId } = useAuth();
  const { t } = useI18n();
  const [branchId, setBranchId] = useState<string>();
  const [learningLevelId, setLearningLevelId] = useState<string>();
  const [classroomId, setClassroomId] = useState<string>();
  const branches = useQuery({ queryKey: ["learning-branches", organizationId], queryFn: () => api.learningBranches(), enabled: visible && Boolean(organizationId) });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: visible && Boolean(organizationId) });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: visible && Boolean(organizationId) });
  const filteredClassrooms = useMemo(() => classrooms.data?.filter((classroom) => classroom.active && (!branchId || classroom.branchId === branchId) && (!learningLevelId || classroom.learningLevelId === learningLevelId)) ?? [], [branchId, classrooms.data, learningLevelId]);

  useEffect(() => {
    if (!visible) return;
    setBranchId(filter.branchId);
    setLearningLevelId(filter.learningLevelId);
    setClassroomId(filter.classroomId);
  }, [filter, visible]);

  const selectBranch = (nextBranchId?: string) => {
    setBranchId(nextBranchId);
    setLearningLevelId(undefined);
    setClassroomId(undefined);
  };
  const selectLevel = (nextLearningLevelId?: string) => {
    setLearningLevelId(nextLearningLevelId);
    setClassroomId(undefined);
  };
  const clear = () => {
    setBranchId(undefined);
    setLearningLevelId(undefined);
    setClassroomId(undefined);
  };

  return <BottomSheet
    visible={visible}
    onClose={onClose}
    closeAccessibilityLabel={t("common.close")}
    title={t("children.filter")}
    negativeAction={{ label: t("children.clearFilters"), onPress: clear }}
    positiveAction={{ label: t("common.ok"), onPress: () => onApply({ branchId, learningLevelId, classroomId }) }}
  >
    <AppText variant="label">{t("children.filterBranch")}</AppText>
    <View style={styles.options}><Button variant={branchId ? "secondary" : "primary"} onPress={() => selectBranch()}>{t("children.allBranches")}</Button>{branches.data?.map((branch) => <Button key={branch.id} variant={branchId === branch.id ? "primary" : "secondary"} onPress={() => selectBranch(branch.id)}>{branch.name}</Button>)}</View>
    <AppText variant="label">{t("children.filterLevel")}</AppText>
    <View style={styles.options}><Button variant={learningLevelId ? "secondary" : "primary"} onPress={() => selectLevel()}>{t("children.allLevels")}</Button>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={learningLevelId === level.id ? "primary" : "secondary"} onPress={() => selectLevel(level.id)}>{level.name}</Button>)}</View>
    <AppText variant="label">{t("children.filterClassroom")}</AppText>
    <View style={styles.options}><Button variant={classroomId ? "secondary" : "primary"} onPress={() => setClassroomId(undefined)}>{t("children.allClassrooms")}</Button>{filteredClassrooms.map((classroom) => <Button key={classroom.id} variant={classroomId === classroom.id ? "primary" : "secondary"} onPress={() => setClassroomId(classroom.id)}>{classroom.name}</Button>)}</View>
  </BottomSheet>;
}

const styles = StyleSheet.create({ options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
