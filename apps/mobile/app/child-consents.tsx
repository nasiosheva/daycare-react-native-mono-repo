import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { consentPurposeKey, consentStatusKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";
import { hasBranchOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function ChildConsentsScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const childProfile = useQuery({ queryKey: ["parent-child-profile", organizationId, childId], queryFn: () => api.parentChildProfile(childId!), enabled: Boolean(childId && membership?.role === "PARENT") });
  const canUseConsents = membership?.role === "PARENT" && hasBranchOfferingCapability(access.data, childProfile.data?.child.branchId, "DAYCARE_OPERATIONS");
  const consents = useQuery({ queryKey: ["child-consents", organizationId, childId], queryFn: () => api.childConsents(childId!), enabled: Boolean(childId && canUseConsents) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["child-consents", organizationId, childId] });
  const decide = useMutation({ mutationFn: ({ definitionId, granted }: { definitionId: string; granted: boolean }) => api.decideConsent(childId!, definitionId, granted), onSuccess: invalidate, onError: (error) => notify(t("consent.decisionFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) });
  const withdraw = useMutation({ mutationFn: (definitionId: string) => api.withdrawConsent(childId!, definitionId), onSuccess: invalidate, onError: (error) => notify(t("consent.decisionFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) });

  if (!profile) return null;
  if (!childId || childProfile.isLoading || access.isLoading) return null;
  if (!canUseConsents) return <Redirect href="/home" />;

  return <AppScreen showBottomNavigation={false} title={t("consent.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText tone="muted">{t("consent.parentDescription")}</AppText>
    {consents.isLoading && <ShimmerList variant="tile" />}
    {consents.isError && <View style={styles.error}><AppText tone="danger">{t("consent.decisionFailed")}</AppText><Button variant="secondary" onPress={() => void consents.refetch()}>{t("common.retry")}</Button></View>}
    {consents.data?.map((item) => <View key={item.definition.id} style={styles.card}>
      <AppText variant="heading">{item.definition.title}</AppText>
      <AppText variant="caption" tone="muted">{t(consentPurposeKey(item.definition.purpose))} · {t("consent.revision", { revision: item.definition.revision })}</AppText>
      <AppText>{item.definition.content}</AppText>
      <AppText variant="label">{t(consentStatusKey(item.status))}</AppText>
      {item.status === "GRANTED" ? <Button variant="danger" loading={withdraw.isPending} onPress={() => void withdraw.mutateAsync(item.definition.id)}>{t("consent.withdraw")}</Button> : <View style={styles.actions}>
        <Button loading={decide.isPending} onPress={() => void decide.mutateAsync({ definitionId: item.definition.id, granted: true })}>{t("consent.grant")}</Button>
        <Button variant="secondary" loading={decide.isPending} onPress={() => void decide.mutateAsync({ definitionId: item.definition.id, granted: false })}>{t("consent.decline")}</Button>
      </View>}
    </View>)}
    {!consents.isLoading && !consents.isError && !consents.data?.length && <AppText tone="muted">{t("consent.empty")}</AppText>}
  </View></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, error: { gap: spacing.sm, alignItems: "flex-start" } });
