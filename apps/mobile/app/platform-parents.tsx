import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppText, Avatar, BackButton, BottomSheet, EmptyState, ErrorState, NavigationCard, PasswordInput, SearchField, ShimmerList, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";

export default function PlatformParentsScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const parents = useQuery({ queryKey: ["platform-parents", debouncedSearch], queryFn: () => api.platformParents(debouncedSearch || undefined), enabled: Boolean(profile?.isPlatformAdmin) });
  const resetPassword = useMutation({ mutationFn: ({ userId, value }: { userId: string; value: string }) => api.resetPlatformParentPassword(userId, value) });

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const selectedParent = parents.data?.find((parent) => parent.id === selectedUserId);
  const closeSheet = () => { setSelectedUserId(null); setPassword(""); setConfirmation(""); };
  const submit = async () => {
    if (!selectedParent) return;
    if (password.length < 6) return notify(t("password.minLength"), undefined, "warning");
    if (password !== confirmation) return notify(t("password.mismatch"), undefined, "warning");
    try {
      await resetPassword.mutateAsync({ userId: selectedParent.id, value: password });
      closeSheet();
      notify(t("platformParents.passwordReset"), undefined, "success");
    } catch (error) {
      notify(t("platformParents.passwordResetFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger");
    }
  };

  return <AppScreen showBottomNavigation={false} title={t("platformParents.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText variant="title">{t("platformParents.title")}</AppText>
    <AppText tone="muted">{t("platformParents.subtitle")}</AppText>
    <SearchField accessibilityLabel={t("platformParents.search")} placeholder={t("platformParents.search")} clearAccessibilityLabel={t("common.clearSearch")} value={search} onChangeText={setSearch} />
    {parents.isFetching && <ShimmerList variant="row" />}
    {parents.isError && !parents.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void parents.refetch()} />}
    {!parents.isFetching && !parents.isError && parents.data?.length === 0 && <EmptyState compact title={t("platformParents.empty")} />}
    {!parents.isFetching && !parents.isError && parents.data?.map((parent) => <NavigationCard key={parent.id} accessibilityLabel={t("platformParents.resetPasswordFor", { name: parent.displayName })} onPress={() => { setSelectedUserId(parent.id); setPassword(""); setConfirmation(""); }} leading={<Avatar name={parent.displayName} />}>
      <View style={styles.titleRow}><AppText variant="h6" style={styles.grow}>{parent.displayName}</AppText><AppText variant="caption" tone="muted">{t(`platformParents.status.${parent.status}` as Parameters<typeof t>[0])}</AppText></View>
      <AppText variant="bodySmall" tone="muted">{parent.email ?? parent.username ?? parent.phoneNumber ?? t("common.noData")}</AppText>
      <AppText variant="caption" tone="muted">{t("platformParents.tenantCount", { count: parent.tenantCount })} · {parent.hasLocalPassword ? t("platformParents.localPasswordReady") : t("platformParents.localPasswordUnavailable")}</AppText>
    </NavigationCard>)}
    <BottomSheet visible={Boolean(selectedParent)} onClose={closeSheet} closeAccessibilityLabel={t("common.close")} title={t("platformParents.resetPasswordTitle")} negativeAction={{ label: t("common.cancel"), onPress: closeSheet }} positiveAction={{ label: t("platformParents.savePassword"), loading: resetPassword.isPending, disabled: !password || !confirmation, onPress: () => void submit() }}>
      <AppText variant="label">{selectedParent?.displayName}</AppText>
      <AppText variant="caption" tone="muted">{t("platformParents.resetPasswordDescription")}</AppText>
      <PasswordInput placeholder={t("password.new")} value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
      <PasswordInput placeholder={t("password.confirm")} value={confirmation} onChangeText={setConfirmation} accessibilityLabel={t("password.confirm")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
});
