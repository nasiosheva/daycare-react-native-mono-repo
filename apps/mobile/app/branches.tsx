import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

type Sheet = "branch" | null;

export default function BranchesScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active !== false;
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tenant-branches", organizationId] });
  const create = useMutation({ mutationFn: api.createBranch.bind(api), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ branchId, input }: { branchId: string; input: { name: string; timezone: string } }) => api.updateBranch(branchId, input), onSuccess: refresh });
  const setPrimary = useMutation({ mutationFn: api.setPrimaryBranch.bind(api), onSuccess: refresh });
  const archive = useMutation({ mutationFn: api.archiveBranch.bind(api), onSuccess: refresh });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [branchId, setBranchId] = useState<string>();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [listOpen, setListOpen] = useState(false);
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const openSheet = (id?: string) => {
    const branch = branches.data?.find((item) => item.id === id);
    setBranchId(branch?.id);
    setName(branch?.name ?? "");
    setTimezone(branch?.timezone ?? "Asia/Jakarta");
    setListOpen(false);
    setSheet("branch");
  };
  const save = async () => {
    if (!name.trim() || !timezone.trim()) return Alert.alert(t("tenant.branchFailed"));
    try {
      if (branchId) await update.mutateAsync({ branchId, input: { name: name.trim(), timezone: timezone.trim() } });
      else await create.mutateAsync({ name: name.trim(), timezone: timezone.trim() });
      setSheet(null);
      Alert.alert(branchId ? t("tenant.branchSaved") : t("tenant.branchAdded"));
    } catch (error) { Alert.alert(t("tenant.branchFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("staffAdmin.branchesTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("staffAdmin.branchesSubtitle")}</AppText>
    {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    <NavigationCard accessibilityLabel={t("staffAdmin.branchesTitle")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("staffAdmin.branchesTitle")}</AppText>
      <AppText tone={branches.data?.length ? "default" : "muted"}>{branches.isFetching ? t("common.loading") : branches.data?.length ? t("staffAdmin.branchesSummary", { count: branches.data.length }) : t("common.noData")}</AppText>
    </NavigationCard>
    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("staffAdmin.branchesTitle")}>
      {canManage && <Button onPress={() => openSheet()}>{t("tenant.addBranch")}</Button>}
      {branches.isFetching && <ShimmerList />}
      {branches.isError && <Button variant="secondary" onPress={() => branches.refetch()}>{t("common.retry")}</Button>}
      {!branches.isFetching && branches.data?.map((branch) => <View key={branch.id} style={styles.card}>
        <View style={styles.content}><AppText variant="label">{branch.name}{branch.primary ? ` · ${t("tenant.primaryBranch")}` : ""}</AppText><AppText tone="muted">{branch.timezone}{branch.active ? "" : ` · ${t("tenant.archivedBranch")}`}</AppText></View>
        {canManage && <View style={styles.actions}><Button variant="secondary" onPress={() => openSheet(branch.id)}>{t("tenant.edit")}</Button>{branch.active && <Button variant="secondary" onPress={() => { setListOpen(false); router.push({ pathname: "/branch-operating-hours", params: { branchId: branch.id } }); }}>{t("overtime.operatingHours")}</Button>}{branch.active && !branch.primary && <Button variant="secondary" loading={setPrimary.isPending} onPress={() => void setPrimary.mutateAsync(branch.id)}>{t("tenant.makePrimary")}</Button>}{branch.active && !branch.primary && <Button variant="danger" loading={archive.isPending} onPress={() => void archive.mutateAsync(branch.id)}>{t("tenant.archiveBranch")}</Button>}</View>}
      </View>)}
    </BottomSheet>
    <BottomSheet visible={sheet === "branch"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={branchId ? t("tenant.edit") : t("tenant.addBranch")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("common.save"), loading: create.isPending || update.isPending, onPress: () => void save() }}>
      <TextInput style={styles.input} placeholder={t("tenant.branchName")} value={name} onChangeText={setName} />
      <TextInput style={styles.input} autoCapitalize="none" placeholder={t("tenant.timezone")} value={timezone} onChangeText={setTimezone} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  content: { gap: spacing.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
