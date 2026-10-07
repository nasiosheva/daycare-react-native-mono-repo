import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, BackButton, Card, EmptyState, ErrorState, ShimmerList } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

type TimelineItem = { id: string; occurredAt: string; icon: "sparkles-outline" | "restaurant-outline" | "bandage-outline"; title: string; description: string; note?: string | null };

export default function ChildDailyTimelineScreen() {
  const router = useRouter();
  const { childId: rawChildId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, profile, organizationId: activeOrganizationId } = useAuth();
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t, formatDateTime } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const enabled = Boolean(childId && organizationId && membership?.active);
  const development = useQuery({ queryKey: ["development-entries", organizationId, childId], queryFn: () => api.developmentEntries(childId!, organizationId), enabled });
  const incidents = useQuery({ queryKey: ["child-incident-reports", organizationId, childId], queryFn: () => api.childIncidentReports(childId!, organizationId), enabled });
  const careLogs = useQuery({ queryKey: ["child-care-logs", organizationId, childId], queryFn: () => api.childCareLogs(childId!, organizationId), enabled });
  const items = useMemo<TimelineItem[]>(() => [
    ...(development.data ?? []).map((entry) => ({ id: `development-${entry.id}`, occurredAt: entry.recordedAt, icon: "sparkles-outline" as const, title: entry.title, description: entry.categoryName, note: entry.content })),
    ...(incidents.data ?? []).map((incident) => ({ id: `incident-${incident.id}`, occurredAt: incident.occurredAt, icon: "bandage-outline" as const, title: t("incident.title"), description: incident.category, note: incident.description })),
    ...(careLogs.data ?? []).map((log) => ({ id: `care-${log.id}`, occurredAt: log.occurredAt, icon: "restaurant-outline" as const, title: log.correctsLogId ? t("operations.correctCareLog") : log.type === "MEAL" ? t("operations.meal") : log.type === "NAP" ? t("operations.nap") : t("operations.toilet"), description: t("operations.careLogs"), note: log.correctionReason ?? log.note })),
  ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()), [careLogs.data, development.data, incidents.data, t]);

  if (!profile) return null;
  if (!childId || !membership || !["PARENT", "STAFF", "STAFF_ADMIN"].includes(membership.role)) return <Redirect href="/home" />;
  const loading = development.isLoading || incidents.isLoading || careLogs.isLoading;
  const loadingError = development.isError || incidents.isError;
  const retry = () => { void development.refetch(); void incidents.refetch(); void careLogs.refetch(); };

  return <AppScreen showBottomNavigation={false} title={t("operations.timeline")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("operations.timelineDescription")}</AppText>
    {loading && <ShimmerList />}
    {loadingError && !loading && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={retry} />}
    {!loading && !loadingError && items.map((item) => <Card key={item.id} icon={item.icon} title={item.title} subtitle={`${item.description} · ${formatDateTime(item.occurredAt)}`}><AppText>{item.note || "–"}</AppText></Card>)}
    {!loading && !loadingError && items.length === 0 && <EmptyState icon="time-outline" title={t("operations.timelineEmpty")} />}
  </AppScreen>;
}
