import { useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildProgramStatus } from "@daycare/api-client";
import { AppText, Badge, BackButton, BottomSheet, Button, Card, EmptyState, ErrorState, InfoRow, MenuItem, MenuSection, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { hasBranchOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function ParentChildProfileScreen() {
  const router = useRouter();
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const childProfile = useQuery({ queryKey: ["parent-child-profile", organizationId, childId], queryFn: () => api.parentChildProfile(childId!), enabled: Boolean(childId && membership?.role === "PARENT") });
  const hasDaycarePickupOperations = hasBranchOfferingCapability(access.data, childProfile.data?.child.branchId, "DAYCARE_OPERATIONS");
  const feedback = useMutation({ mutationFn: ({ programId, note }: { programId: string; note: string }) => api.addParentChildProgramFeedback(childId!, programId, note), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["parent-child-profile", organizationId, childId] }) });
  const [feedbackProgramId, setFeedbackProgramId] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  if (!profile) return null;
  if (!childId || membership?.role !== "PARENT") return <Redirect href="/home" />;
  const openMaps = async () => {
    const url = childProfile.data?.branch.googleMapsUrl;
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert(t("branch.mapsOpenFailed")); }
  };
  const staffRole = (role: string) => role === "NURSE" ? t("children.nurse") : role === "MISS" ? t("children.miss") : t("children.staff");
  const statusLabel = (status: ChildProgramStatus) => t(status === "ACTIVE" ? "children.programStatus.ACTIVE" : status === "COMPLETED" ? "children.programStatus.COMPLETED" : "children.programStatus.DISCONTINUED");
  const submitFeedback = async () => {
    if (!feedbackProgramId || !feedbackNote.trim()) return;
    try { await feedback.mutateAsync({ programId: feedbackProgramId, note: feedbackNote.trim() }); setFeedbackNote(""); setFeedbackProgramId(null); notify(t("children.feedbackSent"), undefined, "success"); }
    catch (error) { notify(t("children.feedbackFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); }
  };
  return <AppScreen showBottomNavigation={false} title={t("children.parentProfile")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    {childProfile.isLoading && <ShimmerList variant="tile" />}
    {childProfile.isError && !childProfile.isFetching && <ErrorState title={t("auth.profileLoadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void childProfile.refetch()} />}
    {childProfile.data && <>
      <View style={styles.hero}>
        <View style={styles.avatar}><AppText variant="h4" style={styles.avatarText}>{childProfile.data.child.fullName.trim().charAt(0).toUpperCase() || "?"}</AppText></View>
        <View style={styles.heroCopy}>
          <AppText variant="h4">{childProfile.data.child.fullName}</AppText>
          <AppText tone="muted">{childProfile.data.child.gender === "MALE" ? t("children.genderMale") : childProfile.data.child.gender === "FEMALE" ? t("children.genderFemale") : t("children.genderUnspecified")} · {childProfile.data.child.dateOfBirth}</AppText>
          {childProfile.data.child.nisn && <AppText variant="caption" tone="muted">{t("children.nisn")}: {childProfile.data.child.nisn}</AppText>}
        </View>
      </View>
      <Card icon="location-outline" title={t("branch.location")}>
        <InfoRow label={childProfile.data.branch.name} value={<AppText tone="muted">{childProfile.data.branch.fullAddress ?? t("branch.locationUnavailable")}</AppText>} />
        {childProfile.data.branch.googleMapsUrl && <Button variant="secondary" leadingIcon={<Ionicons name="map-outline" size={18} color={colors.primary} />} onPress={() => void openMaps()}>{t("branch.openGoogleMaps")}</Button>}
      </Card>
      <MenuSection title={t("children.safetySection")}>
        <MenuItem icon="chatbubbles-outline" title={t("childMessage.menuTitle")} description={t("childMessage.menuDescription")} onPress={() => router.push({ pathname: "/child-messages", params: { childId } } as never)} />
        <MenuItem icon="call-outline" title={t("emergencyContacts.title")} description={t("emergencyContacts.manage")} onPress={() => router.push({ pathname: "/emergency-contacts", params: { childId } } as never)} />
        {hasDaycarePickupOperations && <MenuItem icon="car-outline" title={t("pickup.title")} description={t("pickup.manage")} onPress={() => router.push({ pathname: "/pickup-authorizations", params: { childId } } as never)} />}
        {hasDaycarePickupOperations && <MenuItem icon="shield-checkmark-outline" title={t("consent.title")} description={t("consent.parentDescription")} onPress={() => router.push({ pathname: "/child-consents", params: { childId } } as never)} />}
      </MenuSection>
      <Card icon="grid-outline" title={t("children.classroom")}>{childProfile.data.placement ? <InfoRow label={childProfile.data.placement.learningLevelName ?? t("common.noData")} value={childProfile.data.placement.classroomName} /> : <AppText tone="muted">{t("common.noData")}</AppText>}</Card>
      <Card icon="heart-outline" title={t("children.programs")}>{childProfile.data.programs.map((program) => <View key={program.id} style={styles.item}><View style={styles.itemHeader}><AppText variant="label" style={styles.grow}>{program.name}</AppText><Badge tone={statusTone(program.status)} label={statusLabel(program.status)} /></View>{program.parentSummary && <AppText tone="muted">{program.parentSummary}</AppText>}{program.homeGuidance && <><AppText variant="label">{t("children.homeGuidance")}</AppText><AppText tone="muted">{program.homeGuidance}</AppText></>}{program.steps.map((step) => <View key={step.id} style={styles.step}><AppText variant="label">{step.title}</AppText>{step.homeGuidance && <AppText tone="muted">{step.homeGuidance}</AppText>}</View>)}{program.steps.length === 0 && !program.homeGuidance && <AppText tone="muted">{t("children.noSteps")}</AppText>}{program.feedback.map((item) => <View key={item.id} style={styles.feedbackNote}><Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.muted} /><AppText style={styles.grow}>{item.note}</AppText></View>)}<Button variant="secondary" leadingIcon={<Ionicons name="create-outline" size={18} color={colors.primary} />} onPress={() => setFeedbackProgramId(program.id)}>{t("children.addFeedback")}</Button></View>)}{childProfile.data.programs.length === 0 && <EmptyState compact icon="heart-outline" title={t("children.noPrograms")} />}</Card>
      <Card icon="people-outline" title={t("children.staffAssignments")}>{childProfile.data.staffAssignments.map((staff) => <InfoRow key={`${staff.displayName}-${staff.assignmentRole}`} icon="person-outline" label={staffRole(staff.assignmentRole)} value={staff.displayName} />)}{childProfile.data.staffAssignments.length === 0 && <AppText tone="muted">{t("children.noStaff")}</AppText>}</Card>
      <Card icon="swap-horizontal-outline" title={t("parentEnrollment.transferTitle")} subtitle={t("parentEnrollment.transferDescription")}><Button variant="secondary" onPress={() => router.push({ pathname: "/parent-enrollment-form", params: { transferChildId: childId, transferChildName: childProfile.data.child.fullName } })}>{t("parentEnrollment.transferAction")}</Button></Card>
    </>}
  </View><BottomSheet visible={Boolean(feedbackProgramId)} onClose={() => { setFeedbackProgramId(null); setFeedbackNote(""); }} closeAccessibilityLabel={t("common.close")} title={t("children.addFeedback")} negativeAction={{ label: t("common.cancel"), onPress: () => { setFeedbackProgramId(null); setFeedbackNote(""); } }} positiveAction={{ label: t("common.save"), loading: feedback.isPending, disabled: !feedbackNote.trim(), onPress: () => void submitFeedback() }}><TextField label={t("children.feedbackNote")} value={feedbackNote} onChangeText={setFeedbackNote} multiline /></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  avatarText: { color: colors.onPrimary },
  heroCopy: { flex: 1, gap: 2 },
  item: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  step: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  feedbackNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
});
