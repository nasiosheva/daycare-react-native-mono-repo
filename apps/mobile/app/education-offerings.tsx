import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EducationOffering } from "@daycare/api-client";
import type { EducationOfferingStatus, InstitutionType } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

const nextOfferingStatus: Partial<Record<EducationOfferingStatus, EducationOfferingStatus>> = {
  DRAFT: "PUBLISHED",
  PUBLISHED: "PAUSED",
  PAUSED: "PUBLISHED",
  CLOSED: "ARCHIVED",
};

export default function EducationOfferingsScreen() {
  const router = useRouter(); const { api, profile, organizationId } = useAuth(); const { t } = useI18n(); const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const offerings = useQuery({ queryKey: ["education-offerings", organizationId], queryFn: () => api.educationOfferings(), enabled: membership?.role === "STAFF_ADMIN" });
  const branches = useQuery({ queryKey: ["tenant-branches", organizationId], queryFn: () => api.branches(), enabled: membership?.role === "STAFF_ADMIN" });
  const [open, setOpen] = useState(false); const [branchId, setBranchId] = useState(""); const [institutionType, setInstitutionType] = useState<InstitutionType | "">(""); const [error, setError] = useState<string | null>(null);
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["education-offerings", organizationId] }), client.invalidateQueries({ queryKey: ["ui-access-context", organizationId] })]);
  const create = useMutation({ mutationFn: () => api.createEducationOffering({ branchId, institutionType: institutionType as InstitutionType, enrollmentMode: institutionType === "DAYCARE" ? "DAYCARE_SERVICE" : "SCHOOL_ADMISSION" }), onSuccess: () => { void refresh(); close(); }, onError: (value) => setError(value instanceof Error ? value.message : t("tenant.saveFailed")) });
  const changeStatus = useMutation({ mutationFn: ({ offering, status }: { offering: EducationOffering; status: EducationOfferingStatus }) => api.setEducationOfferingStatus(offering.id, status), onSuccess: refresh, onError: (value) => setError(value instanceof Error ? value.message : t("tenant.saveFailed")) });
  const close = () => { setOpen(false); setBranchId(""); setInstitutionType(""); setError(null); };
  const submit = () => { if (!branchId || !institutionType) { setError(t("tenant.dataRequired")); return; } create.mutate(); };
  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;
  const activeBranches = branches.data?.filter((branch) => branch.active) ?? [];
  return <AppScreen showBottomNavigation={false} title={t("tenant.institutionTypes")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={<FloatingActionButton accessibilityLabel={t("institutionCatalog.add")} onPress={() => setOpen(true)}>+ {t("institutionCatalog.add")}</FloatingActionButton>}><View style={styles.content}>
    <AppText variant="title">{t("tenant.institutionTypes")}</AppText><AppText tone="muted">{t("tenant.institutionTypesInfo")}</AppText>
    {offerings.isLoading && <ShimmerList variant="card" />}
    {offerings.data?.map((offering) => <OfferingCard key={offering.id} offering={offering} branchName={branches.data?.find((branch) => branch.id === offering.branchId)?.name ?? t("common.noData")} onStatus={(status) => changeStatus.mutate({ offering, status })} loading={changeStatus.isPending} />)}
    {!offerings.isLoading && offerings.data?.length === 0 && <AppText tone="muted">{t("common.noData")}</AppText>}
    <BottomSheet visible={open} onClose={close} closeAccessibilityLabel={t("common.close")} title={t("institutionCatalog.add")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("common.save"), loading: create.isPending, onPress: submit }}>
      {error && <AppText tone="danger">{error}</AppText>}<AppText variant="label">{t("tenant.branches")}</AppText><View style={styles.options}>{activeBranches.map((branch) => <Button key={branch.id} variant={branchId === branch.id ? "primary" : "secondary"} onPress={() => setBranchId(branch.id)}>{branch.name}</Button>)}</View>
      <AppText variant="label">{t("tenant.institutionTypes")}</AppText><View style={styles.options}>{membership.institutionTypes.map((type) => <Button key={type} variant={institutionType === type ? "primary" : "secondary"} onPress={() => setInstitutionType(type)}>{type}</Button>)}</View>
    </BottomSheet>
  </View></AppScreen>;
}

function OfferingCard({ offering, branchName, onStatus, loading }: { offering: EducationOffering; branchName: string; onStatus: (status: EducationOfferingStatus) => void; loading: boolean }) {
  const { t } = useI18n(); const nextStatus = nextOfferingStatus[offering.status];
  return <View style={styles.card}><AppText variant="heading">{offering.institutionType}</AppText><AppText tone="muted">{branchName} · {offering.status}</AppText>{nextStatus && <Button variant={nextStatus === "PUBLISHED" ? "primary" : "secondary"} loading={loading} onPress={() => onStatus(nextStatus)}>{nextStatus === "PUBLISHED" ? t("tenant.activate") : nextStatus === "PAUSED" ? t("tenant.suspend") : t("learning.archive")}</Button>}</View>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
