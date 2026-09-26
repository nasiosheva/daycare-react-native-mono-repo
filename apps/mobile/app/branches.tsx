import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Banner, BottomSheet, Button, ErrorState, FloatingActionButton, SearchField, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { hasBranchOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

type Sheet = "branch" | null;

export default function BranchesScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.active !== false;
  const access = useUiAccessContext(Boolean(membership));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId, debouncedSearch], queryFn: () => api.branches(debouncedSearch || undefined), enabled: membership?.role === "STAFF_ADMIN" });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tenant-branches", organizationId] });
  const create = useMutation({ mutationFn: api.createBranch.bind(api), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ branchId, input }: { branchId: string; input: { name: string; timezone: string; fullAddress: string; googleMapsUrl?: string } }) => api.updateBranch(branchId, input), onSuccess: refresh });
  const setPrimary = useMutation({ mutationFn: api.setPrimaryBranch.bind(api), onSuccess: refresh });
  const archive = useMutation({ mutationFn: api.archiveBranch.bind(api), onSuccess: refresh });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [branchId, setBranchId] = useState<string>();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [fullAddress, setFullAddress] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const openSheet = (id?: string) => {
    const branch = branches.data?.find((item) => item.id === id);
    setBranchId(branch?.id);
    setName(branch?.name ?? "");
    setTimezone(branch?.timezone ?? "Asia/Jakarta");
    setFullAddress(branch?.fullAddress ?? "");
    setGoogleMapsUrl(branch?.googleMapsUrl ?? "");
    setSheet("branch");
  };
  const save = async () => {
    if (!name.trim() || !timezone.trim() || !fullAddress.trim()) return notify(t("tenant.branchFailed"), t("tenant.branchRequired"), "danger");
    try {
      const input = { name: name.trim(), timezone: timezone.trim(), fullAddress: fullAddress.trim(), googleMapsUrl: googleMapsUrl.trim() || undefined };
      if (branchId) await update.mutateAsync({ branchId, input });
      else await create.mutateAsync(input);
      setSheet(null);
      notify(branchId ? t("tenant.branchSaved") : t("tenant.branchAdded"), undefined, "success");
    } catch (error) { notify(t("tenant.branchFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); }
  };

  return <AppScreen showBottomNavigation={false} title={t("staffAdmin.branchesTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("tenant.addBranch")} onPress={() => openSheet()}>{t("tenant.addBranch")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("staffAdmin.branchesSubtitle")}</AppText>
    {membership?.active === false && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    <SearchField accessibilityLabel={t("home.branchSearchPlaceholder")} placeholder={t("home.branchSearchPlaceholder")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} />
    {branches.isFetching && <ShimmerList />}
    {branches.isError && !branches.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void branches.refetch()} />}
    {!branches.isFetching && !branches.data?.length && <AppText tone="muted">{debouncedSearch ? t("common.noResults") : t("common.noData")}</AppText>}
    {!branches.isFetching && branches.data?.map((branch) => <View key={branch.id} style={styles.card}>
      <View style={styles.content}><AppText variant="label">{branch.name}{branch.primary ? ` · ${t("tenant.primaryBranch")}` : ""}</AppText><AppText tone="muted">{branch.fullAddress ?? t("branch.locationUnavailable")}</AppText><AppText variant="caption" tone="muted">{branch.timezone}{branch.active ? "" : ` · ${t("tenant.archivedBranch")}`}</AppText></View>
      {canManage && <View style={styles.actions}><Button variant="secondary" onPress={() => openSheet(branch.id)}>{t("tenant.edit")}</Button>{branch.active && hasBranchOfferingCapability(access.data, branch.id, "DAYCARE_OPERATIONS") && <Button variant="secondary" onPress={() => router.push({ pathname: "/branch-operating-hours", params: { branchId: branch.id } })}>{t("overtime.operatingHours")}</Button>}{branch.active && !branch.primary && <Button variant="secondary" loading={setPrimary.isPending} onPress={() => void setPrimary.mutateAsync(branch.id)}>{t("tenant.makePrimary")}</Button>}{branch.active && !branch.primary && <Button variant="danger" loading={archive.isPending} onPress={() => void archive.mutateAsync(branch.id)}>{t("tenant.archiveBranch")}</Button>}</View>}
    </View>)}
    <BottomSheet visible={sheet === "branch"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={branchId ? t("tenant.edit") : t("tenant.addBranch")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("common.save"), loading: create.isPending || update.isPending, onPress: () => void save() }}>
      <TextField label={t("tenant.branchName")} value={name} onChangeText={setName} />
      <TextField label={t("tenant.timezone")} autoCapitalize="none" value={timezone} onChangeText={setTimezone} />
      <TextField label={t("branch.fullAddress")} multiline value={fullAddress} onChangeText={setFullAddress} />
      <TextField label={t("branch.googleMapsUrl")} autoCapitalize="none" autoCorrect={false} keyboardType="url" value={googleMapsUrl} onChangeText={setGoogleMapsUrl} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  content: { gap: spacing.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  addressInput: { minHeight: 104, paddingVertical: spacing.sm, textAlignVertical: "top" },
});
