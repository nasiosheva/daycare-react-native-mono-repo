import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Badge, BackButton, Button, Card, EmptyState, ErrorState, ShimmerList, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
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
    {consents.isError && !consents.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void consents.refetch()} />}
    {consents.data?.map((item) => <Card key={item.definition.id} icon="shield-checkmark-outline" title={item.definition.title} subtitle={`${t(consentPurposeKey(item.definition.purpose))} · ${t("consent.revision", { revision: item.definition.revision })}`} trailing={<Badge tone={statusTone(item.status)} label={t(consentStatusKey(item.status))} />}>
      <AppText>{item.definition.content}</AppText>
      {item.status === "GRANTED" ? <Button variant="danger" loading={withdraw.isPending} onPress={() => void withdraw.mutateAsync(item.definition.id)}>{t("consent.withdraw")}</Button> : <View style={styles.actions}>
        <Button style={styles.action} variant="secondary" loading={decide.isPending} onPress={() => void decide.mutateAsync({ definitionId: item.definition.id, granted: false })}>{t("consent.decline")}</Button>
        <Button style={styles.action} loading={decide.isPending} onPress={() => void decide.mutateAsync({ definitionId: item.definition.id, granted: true })}>{t("consent.grant")}</Button>
      </View>}
    </Card>)}
    {!consents.isLoading && !consents.isError && !consents.data?.length && <EmptyState icon="shield-checkmark-outline" title={t("consent.empty")} />}
  </View></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 } });
