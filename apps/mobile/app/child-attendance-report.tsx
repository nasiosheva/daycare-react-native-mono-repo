import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, BackButton, Banner, Chip, ErrorState, ShimmerList, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { DownloadReportActions } from "@/document-export/DownloadReportActions";

function defaultPeriod() {
  const today = new Date();
  return { startsOn: formatIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), endsOn: formatIsoDate(today) };
}

export default function ChildAttendanceReportScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const initialPeriod = useMemo(defaultPeriod, []);
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
  const activeBranches = branches.data?.filter((branch) => branch.active) ?? [];
  const [branchId, setBranchId] = useState<string>();
  const [startsOn, setStartsOn] = useState(initialPeriod.startsOn);
  const [endsOn, setEndsOn] = useState(initialPeriod.endsOn);
  const today = formatIsoDate(new Date());

  useEffect(() => {
    if (!branchId && activeBranches[0]) setBranchId(activeBranches[0].id);
  }, [activeBranches, branchId]);

  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const canExport = membership?.active === true && Boolean(branchId) && startsOn <= endsOn;
  return <AppScreen showBottomNavigation={false} title={t("childAttendanceReport.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("childAttendanceReport.description")}</AppText>
    {!membership.active && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    <View style={styles.field}><AppText variant="label">{t("childAttendanceReport.branch")}</AppText>
      {branches.isLoading && <ShimmerList />}
      {branches.isError && !branches.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void branches.refetch()} />}
      {!branches.isLoading && !branches.isError && <View style={styles.branchOptions}>{activeBranches.map((branch) => <Chip key={branch.id} label={branch.name} selected={branchId === branch.id} onPress={() => setBranchId(branch.id)} />)}</View>}
      {!branches.isLoading && !branches.isError && activeBranches.length === 0 && <Banner tone="danger" title={t("childAttendanceReport.noActiveBranches")} />}
    </View>
    <View style={styles.field}><AppText variant="label">{t("childAttendanceReport.startDate")}</AppText><DatePicker placeholder={t("childAttendanceReport.startDate")} value={startsOn} maximumDate={endsOn} onChange={(value) => { setStartsOn(value); if (value > endsOn) setEndsOn(value); }} /></View>
    <View style={styles.field}><AppText variant="label">{t("childAttendanceReport.endDate")}</AppText><DatePicker placeholder={t("childAttendanceReport.endDate")} value={endsOn} minimumDate={startsOn} maximumDate={today} onChange={setEndsOn} /></View>
    {startsOn > endsOn && <Banner tone="danger" title={t("childAttendanceReport.invalidPeriod")} />}
    {membership.active && <DownloadReportActions disabled={!canExport} download={(format) => api.downloadChildAttendanceReport(format, { branchId: branchId!, startsOn, endsOn })} />}
    <AppText variant="caption" tone="muted">{t("childAttendanceReport.note")}</AppText>
  </AppScreen>;
}

const styles = StyleSheet.create({ field: { gap: spacing.sm }, branchOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, });
