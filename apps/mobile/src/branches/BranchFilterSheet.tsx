import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, BottomSheet, Button, spacing } from "@daycare/ui";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

type BranchFilterSheetProps = {
  visible: boolean;
  branchId?: string;
  onClose: () => void;
  onApply: (branchId?: string) => void;
};

type BranchFilterControlProps = {
  branchId?: string;
  onChange: (branchId?: string) => void;
};

export function BranchFilterControl({ branchId, onChange }: BranchFilterControlProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return <View style={styles.control}>
    <Button variant="secondary" onPress={() => setVisible(true)}>{t("branchFilter.title")}</Button>
    {branchId && <AppText tone="muted">{t("branchFilter.active")}</AppText>}
    <BranchFilterSheet visible={visible} branchId={branchId} onClose={() => setVisible(false)} onApply={(nextBranchId) => { onChange(nextBranchId); setVisible(false); }} />
  </View>;
}

export function BranchFilterSheet({ visible, branchId, onClose, onApply }: BranchFilterSheetProps) {
  const { api, organizationId } = useAuth();
  const { t } = useI18n();
  const [draftBranchId, setDraftBranchId] = useState<string>();
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: visible && Boolean(organizationId) });

  useEffect(() => {
    if (visible) setDraftBranchId(branchId);
  }, [branchId, visible]);

  return <BottomSheet
    visible={visible}
    onClose={onClose}
    closeAccessibilityLabel={t("common.close")}
    title={t("branchFilter.title")}
    negativeAction={{ label: t("branchFilter.clear"), onPress: () => setDraftBranchId(undefined) }}
    positiveAction={{ label: t("common.ok"), onPress: () => onApply(draftBranchId) }}
  >
    <AppText variant="label">{t("branchFilter.branch")}</AppText>
    <View style={styles.options}><Button variant={draftBranchId ? "secondary" : "primary"} onPress={() => setDraftBranchId(undefined)}>{t("branchFilter.allBranches")}</Button>{branches.data?.map((branch) => <Button key={branch.id} variant={draftBranchId === branch.id ? "primary" : "secondary"} onPress={() => setDraftBranchId(branch.id)}>{branch.name}</Button>)}</View>
  </BottomSheet>;
}

const styles = StyleSheet.create({ control: { gap: spacing.xs }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
