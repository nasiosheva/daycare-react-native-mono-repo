import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChildProgramStatus } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, ToggleSwitch, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { useAddChildProgramStaffNote, useAddChildProgramStep, useChildProfile, useRemoveChildProgramStep, useUpdateChildProgram, useUpdateChildProgramStep } from "@/children/useChildManagement";

const programStatuses: ChildProgramStatus[] = ["ACTIVE", "COMPLETED", "DISCONTINUED"];

export default function ChildProgramDetailScreen() {
  const router = useRouter();
  const { childId: rawChildId, programId: rawProgramId } = useLocalSearchParams<{ childId?: string; programId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const programId = typeof rawProgramId === "string" ? rawProgramId : null;
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManagePrograms = membership?.role === "STAFF_ADMIN" || (membership?.role === "STAFF" && membership.canManageChildPrograms);
  const childProfile = useChildProfile(childId);
  const program = childProfile.data?.programs.find((item) => item.id === programId);
  const updateProgram = useUpdateChildProgram(childId ?? "", programId ?? "");
  const addStep = useAddChildProgramStep(childId ?? "", programId ?? "");
  const updateStep = useUpdateChildProgramStep(childId ?? "", programId ?? "");
  const removeStep = useRemoveChildProgramStep(childId ?? "", programId ?? "");
  const addStaffNote = useAddChildProgramStaffNote(childId ?? "", programId ?? "");
  const [sheet, setSheet] = useState<"program" | "step" | "note" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ChildProgramStatus>("ACTIVE");
  const [parentVisible, setParentVisible] = useState(false);
  const [parentSummary, setParentSummary] = useState("");
  const [homeGuidance, setHomeGuidance] = useState("");
  const [stepId, setStepId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepHomeGuidance, setStepHomeGuidance] = useState("");
  const [stepParentVisible, setStepParentVisible] = useState(false);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [stepDisplayOrder, setStepDisplayOrder] = useState("0");
  const [note, setNote] = useState("");
  const [noteStepId, setNoteStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    setName(program.name);
    setDescription(program.description);
    setStatus(program.status);
    setParentVisible(program.parentVisible);
    setParentSummary(program.parentSummary ?? "");
    setHomeGuidance(program.homeGuidance ?? "");
  }, [program]);

  const statusLabel = (value: ChildProgramStatus) => t(value === "ACTIVE" ? "children.programStatus.ACTIVE" : value === "COMPLETED" ? "children.programStatus.COMPLETED" : "children.programStatus.DISCONTINUED");
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : t("auth.tryAgain");
  const stepOrder = useMemo(() => Number.parseInt(stepDisplayOrder, 10), [stepDisplayOrder]);

  if (!profile) return null;
  if (!childId || !programId || !membership?.active || !canManagePrograms) return <Redirect href="/home" />;
  if (childProfile.isLoading) return <AppScreen showBottomNavigation={false} title={t("children.programDetail")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><ShimmerList variant="tile" /></AppScreen>;
  if (!program) return <Redirect href={{ pathname: "/child-detail", params: { childId } }} />;

  const openStepForm = (selectedStepId?: string) => {
    const selectedStep = program.steps.find((item) => item.id === selectedStepId);
    setStepId(selectedStep?.id ?? null);
    setStepTitle(selectedStep?.title ?? "");
    setStepDescription(selectedStep?.description ?? "");
    setStepHomeGuidance(selectedStep?.homeGuidance ?? "");
    setStepParentVisible(selectedStep?.parentVisible ?? false);
    setStepCompleted(selectedStep?.completed ?? false);
    setStepDisplayOrder(String(selectedStep?.displayOrder ?? program.steps.length));
    setSheet("step");
  };
  const closeStepForm = () => { setSheet(null); setStepId(null); setStepTitle(""); setStepDescription(""); setStepHomeGuidance(""); setStepParentVisible(false); setStepCompleted(false); setStepDisplayOrder("0"); };
  const saveProgram = async () => {
    if (!name.trim()) return;
    try {
      await updateProgram.mutateAsync({ name: name.trim(), description: description.trim() || undefined, status, parentVisible, parentSummary: parentSummary.trim() || undefined, homeGuidance: homeGuidance.trim() || undefined });
      setSheet(null);
    } catch (error) { notify(t("children.programFailed"), errorMessage(error)); }
  };
  const saveStep = async () => {
    if (!stepTitle.trim() || !Number.isFinite(stepOrder) || stepOrder < 0) return;
    const input = { title: stepTitle.trim(), description: stepDescription.trim() || undefined, homeGuidance: stepHomeGuidance.trim() || undefined, parentVisible: stepParentVisible, completed: stepCompleted, displayOrder: stepOrder };
    try {
      if (stepId) await updateStep.mutateAsync({ stepId, input });
      else await addStep.mutateAsync(input);
      closeStepForm();
    } catch (error) { notify(t("children.programFailed"), errorMessage(error)); }
  };
  const saveStaffNote = async () => {
    if (!note.trim()) return;
    try { await addStaffNote.mutateAsync({ note: note.trim(), stepId: noteStepId ?? undefined }); setNote(""); setNoteStepId(null); setSheet(null); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error)); }
  };
  const deleteStep = async (id: string) => {
    try { await removeStep.mutateAsync(id); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error)); }
  };

  return <AppScreen showBottomNavigation={false} title={t("children.programDetail")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <View style={styles.card}>
      <View style={styles.heading}><View style={styles.grow}><AppText variant="h5">{program.name}</AppText><AppText tone="muted">{statusLabel(program.status)}</AppText></View><Button variant="secondary" onPress={() => setSheet("program")}>{t("common.edit")}</Button></View>
      {program.description && <AppText tone="muted">{program.description}</AppText>}
      {program.parentVisible && <AppText variant="caption" tone="muted">{t("children.parentVisible")}</AppText>}
      {program.homeGuidance && <><AppText variant="label">{t("children.homeGuidance")}</AppText><AppText tone="muted">{program.homeGuidance}</AppText></>}
    </View>

    <View style={styles.section}><View style={styles.heading}><AppText variant="h5">{t("children.steps")}</AppText><Button variant="secondary" onPress={() => openStepForm()}>{t("children.addStep")}</Button></View>
      {program.steps.map((step) => <View key={step.id} style={styles.card}><View style={styles.heading}><View style={styles.grow}><AppText variant="label">{step.title}</AppText><AppText variant="caption" tone="muted">{step.completed ? t("children.completed") : t("children.markIncomplete")}{step.parentVisible ? ` · ${t("children.parentVisible")}` : ""}</AppText></View><View style={styles.actions}><Button variant="secondary" onPress={() => openStepForm(step.id)}>{t("common.edit")}</Button><Button variant="danger" loading={removeStep.isPending} onPress={() => void deleteStep(step.id)}>{t("children.remove")}</Button></View></View>{step.description && <AppText tone="muted">{step.description}</AppText>}{step.homeGuidance && <><AppText variant="caption" tone="muted">{t("children.homeGuidance")}</AppText><AppText tone="muted">{step.homeGuidance}</AppText></>}</View>)}
      {program.steps.length === 0 && <AppText tone="muted">{t("children.noSteps")}</AppText>}
    </View>

    <View style={styles.section}><View style={styles.heading}><AppText variant="h5">{t("children.staffNotes")}</AppText><Button variant="secondary" onPress={() => setSheet("note")}>{t("children.addStaffNote")}</Button></View>
      {program.staffNotes.map((item) => <View key={item.id} style={styles.card}><AppText>{item.note}</AppText><AppText variant="caption" tone="muted">{item.authorName}{item.stepId ? ` · ${program.steps.find((step) => step.id === item.stepId)?.title ?? t("common.noData")}` : ""}</AppText></View>)}
      {program.staffNotes.length === 0 && <AppText tone="muted">{t("children.noStaffNotes")}</AppText>}
    </View>

    <View style={styles.section}><AppText variant="h5">{t("children.parentFeedback")}</AppText>
      {program.parentFeedback.map((item) => <View key={item.id} style={styles.card}><AppText>{item.note}</AppText><AppText variant="caption" tone="muted">{item.parentName ?? t("common.noData")}</AppText></View>)}
      {program.parentFeedback.length === 0 && <AppText tone="muted">{t("children.noFeedback")}</AppText>}
    </View>
  </View>
    <BottomSheet visible={sheet === "program"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("common.edit")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("common.save"), loading: updateProgram.isPending, disabled: !name.trim(), onPress: () => void saveProgram() }}>
      <TextInput style={styles.input} placeholder={t("children.programName")} value={name} onChangeText={setName} />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.programDescription")} value={description} onChangeText={setDescription} multiline />
      <AppText variant="label">{t("children.programStatus")}</AppText><View style={styles.options}>{programStatuses.map((item) => <Button key={item} variant={status === item ? "primary" : "secondary"} onPress={() => setStatus(item)}>{statusLabel(item)}</Button>)}</View>
      <ToggleSwitch label={t("children.parentVisible")} description={t("children.parentVisibleDescription")} value={parentVisible} onValueChange={setParentVisible} accessibilityLabel={t("children.parentVisible")} />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.parentSummary")} value={parentSummary} onChangeText={setParentSummary} multiline />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.homeGuidance")} value={homeGuidance} onChangeText={setHomeGuidance} multiline />
    </BottomSheet>
    <BottomSheet visible={sheet === "step"} onClose={closeStepForm} closeAccessibilityLabel={t("common.close")} title={t(stepId ? "children.editStep" : "children.addStep")} negativeAction={{ label: t("common.cancel"), onPress: closeStepForm }} positiveAction={{ label: t("common.save"), loading: addStep.isPending || updateStep.isPending, disabled: !stepTitle.trim() || !Number.isFinite(stepOrder) || stepOrder < 0, onPress: () => void saveStep() }}>
      <TextInput style={styles.input} placeholder={t("children.stepTitle")} value={stepTitle} onChangeText={setStepTitle} />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.stepDescription")} value={stepDescription} onChangeText={setStepDescription} multiline />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.homeGuidance")} value={stepHomeGuidance} onChangeText={setStepHomeGuidance} multiline />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.order")} value={stepDisplayOrder} onChangeText={setStepDisplayOrder} />
      <ToggleSwitch label={t("children.completed")} value={stepCompleted} onValueChange={setStepCompleted} accessibilityLabel={t("children.completed")} />
      <ToggleSwitch label={t("children.stepParentVisible")} description={program.parentVisible ? undefined : t("children.parentVisibleDescription")} value={stepParentVisible} onValueChange={setStepParentVisible} disabled={!program.parentVisible} accessibilityLabel={t("children.stepParentVisible")} />
    </BottomSheet>
    <BottomSheet visible={sheet === "note"} onClose={() => { setNote(""); setNoteStepId(null); setSheet(null); }} closeAccessibilityLabel={t("common.close")} title={t("children.addStaffNote")} negativeAction={{ label: t("common.cancel"), onPress: () => { setNote(""); setNoteStepId(null); setSheet(null); } }} positiveAction={{ label: t("common.save"), loading: addStaffNote.isPending, disabled: !note.trim(), onPress: () => void saveStaffNote() }}>
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.staffNote")} value={note} onChangeText={setNote} multiline />
      <AppText variant="label">{t("children.steps")}</AppText><View style={styles.options}><Button variant={noteStepId === null ? "primary" : "secondary"} onPress={() => setNoteStepId(null)}>{t("children.programDetail")}</Button>{program.steps.map((step) => <Button key={step.id} variant={noteStepId === step.id ? "primary" : "secondary"} onPress={() => setNoteStepId(step.id)}>{step.title}</Button>)}</View>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  section: { gap: spacing.sm },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, justifyContent: "space-between" },
  grow: { flex: 1, gap: spacing.xs },
  actions: { gap: spacing.xs, alignItems: "flex-end" },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: "top" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
