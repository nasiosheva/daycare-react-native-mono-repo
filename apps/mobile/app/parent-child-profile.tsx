import { Alert, Linking, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, BackButton, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export default function ParentChildProfileScreen() {
  const router = useRouter();
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const childProfile = useQuery({ queryKey: ["parent-child-profile", organizationId, childId], queryFn: () => api.parentChildProfile(childId!), enabled: Boolean(childId && membership?.role === "PARENT") });
  if (!profile) return null;
  if (!childId || membership?.role !== "PARENT") return <Redirect href="/home" />;
  const openMaps = async () => {
    const url = childProfile.data?.branch.googleMapsUrl;
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert(t("branch.mapsOpenFailed")); }
  };
  const staffRole = (role: string) => role === "NURSE" ? t("children.nurse") : role === "MISS" ? t("children.miss") : t("children.staff");
  return <AppScreen showBottomNavigation={false} title={t("children.parentProfile")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    {childProfile.isLoading && <ShimmerList variant="tile" />}
    {childProfile.isError && <View style={styles.feedback}><AppText tone="danger">{t("auth.profileLoadFailed")}</AppText><Button variant="secondary" onPress={() => void childProfile.refetch()}>{t("common.retry")}</Button></View>}
    {childProfile.data && <>
      <View style={styles.card}><AppText variant="h5">{childProfile.data.child.fullName}</AppText><AppText tone="muted">{childProfile.data.child.gender === "MALE" ? t("children.genderMale") : childProfile.data.child.gender === "FEMALE" ? t("children.genderFemale") : t("children.genderUnspecified")}</AppText><AppText tone="muted">{childProfile.data.child.dateOfBirth}</AppText>{childProfile.data.child.nisn && <AppText tone="muted">{t("children.nisn")}: {childProfile.data.child.nisn}</AppText>}</View>
      <View style={styles.card}><AppText variant="h5">{t("branch.location")}</AppText><AppText variant="label">{childProfile.data.branch.name}</AppText><AppText tone="muted">{childProfile.data.branch.fullAddress ?? t("branch.locationUnavailable")}</AppText>{childProfile.data.branch.googleMapsUrl && <Button variant="secondary" onPress={() => void openMaps()}>{t("branch.openGoogleMaps")}</Button>}</View>
      <View style={styles.card}><AppText variant="h5">{t("children.classroom")}</AppText>{childProfile.data.placement ? <><AppText variant="label">{childProfile.data.placement.classroomName}</AppText><AppText tone="muted">{childProfile.data.placement.learningLevelName ?? t("common.noData")}</AppText></> : <AppText tone="muted">{t("common.noData")}</AppText>}</View>
      <View style={styles.card}><AppText variant="h5">{t("children.programs")}</AppText>{childProfile.data.programs.map((program) => <View key={program.id} style={styles.item}><AppText variant="label">{program.name}</AppText>{program.description && <AppText tone="muted">{program.description}</AppText>}</View>)}{childProfile.data.programs.length === 0 && <AppText tone="muted">{t("children.noPrograms")}</AppText>}</View>
      <View style={styles.card}><AppText variant="h5">{t("children.staffAssignments")}</AppText>{childProfile.data.staffAssignments.map((staff) => <View key={`${staff.displayName}-${staff.assignmentRole}`} style={styles.item}><AppText variant="label">{staff.displayName}</AppText><AppText tone="muted">{staffRole(staff.assignmentRole)}</AppText></View>)}{childProfile.data.staffAssignments.length === 0 && <AppText tone="muted">{t("children.noStaff")}</AppText>}</View>
    </>}
  </View></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, item: { gap: spacing.xs, paddingTop: spacing.sm }, feedback: { gap: spacing.sm, alignItems: "flex-start" } });
