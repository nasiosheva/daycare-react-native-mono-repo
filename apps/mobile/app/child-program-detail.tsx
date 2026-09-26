import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChildProgramStatus } from "@daycare/api-client";
import { AppText, Badge, BackButton, BottomSheet, Button, Card, Chip, EmptyState, InfoRow, SectionHeader, ShimmerList, TextField, ToggleSwitch, colors, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
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
    } catch (error) { notify(t("children.programFailed"), errorMessage(error), "danger"); }
  };
  const saveStep = async () => {
    if (!stepTitle.trim() || !Number.isFinite(stepOrder) || stepOrder < 0) return;
    const input = { title: stepTitle.trim(), description: stepDescription.trim() || undefined, homeGuidance: stepHomeGuidance.trim() || undefined, parentVisible: stepParentVisible, completed: stepCompleted, displayOrder: stepOrder };
    try {
      if (stepId) await updateStep.mutateAsync({ stepId, input });
      else await addStep.mutateAsync(input);
      closeStepForm();
    } catch (error) { notify(t("children.programFailed"), errorMessage(error), "danger"); }
  };
  const saveStaffNote = async () => {
    if (!note.trim()) return;
    try { await addStaffNote.mutateAsync({ note: note.trim(), stepId: noteStepId ?? undefined }); setNote(""); setNoteStepId(null); setSheet(null); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error), "danger"); }
  };
  const deleteStep = async (id: string) => {
    try { await removeStep.mutateAsync(id); }
    catch (error) { notify(t("children.programFailed"), errorMessage(error), "danger"); }
  };

  return <AppScreen showBottomNavigation={false} title={t("children.programDetail")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <Card icon="heart-outline" title={program.name} trailing={<Badge tone={statusTone(program.status)} label={statusLabel(program.status)} />}>
      {program.description && <AppText tone="muted">{program.description}</AppText>}
      {program.parentVisible && <Badge tone="info" icon="eye-outline" label={t("children.parentVisible")} />}
      {program.homeGuidance && <InfoRow icon="home-outline" label={t("children.homeGuidance")} value={<AppText>{program.homeGuidance}</AppText>} />}
      <Button variant="secondary" leadingIcon={<Ionicons name="create-outline" size={18} color={colors.primary} />} onPress={() => setSheet("program")}>{t("common.edit")}</Button>
    </Card>

    <View style={styles.section}><SectionHeader title={t("children.steps")} action={<Button variant="ghost" leadingIcon={<Ionicons name="add" size={18} color={colors.primary} />} onPress={() => openStepForm()}>{t("children.addStep")}</Button>} />
      {program.steps.map((step) => <Card key={step.id} icon={step.completed ? "checkmark-circle" : "ellipse-outline"} title={step.title} trailing={<Badge tone={step.completed ? "success" : "neutral"} label={step.completed ? t("children.completed") : t("children.markIncomplete")} />}>{step.parentVisible && <Badge tone="info" icon="eye-outline" label={t("children.parentVisible")} />}{step.description && <AppText tone="muted">{step.description}</AppText>}{step.homeGuidance && <InfoRow icon="home-outline" label={t("children.homeGuidance")} value={<AppText>{step.homeGuidance}</AppText>} />}<View style={styles.actions}><Button style={styles.grow} variant="secondary" leadingIcon={<Ionicons name="create-outline" size={18} color={colors.primary} />} onPress={() => openStepForm(step.id)}>{t("common.edit")}</Button><Button style={styles.grow} variant="ghost" loading={removeStep.isPending} onPress={() => void deleteStep(step.id)}><AppText variant="label" tone="danger">{t("children.remove")}</AppText></Button></View></Card>)}
      {program.steps.length === 0 && <EmptyState compact icon="list-outline" title={t("children.noSteps")} action={{ label: t("children.addStep"), onPress: () => openStepForm() }} />}
    </View>

    <View style={styles.section}><SectionHeader title={t("children.staffNotes")} action={<Button variant="ghost" leadingIcon={<Ionicons name="add" size={18} color={colors.primary} />} onPress={() => setSheet("note")}>{t("children.addStaffNote")}</Button>} />
      {program.staffNotes.map((item) => <Card key={item.id} subtitle={`${item.authorName}${item.stepId ? ` · ${program.steps.find((step) => step.id === item.stepId)?.title ?? t("common.noData")}` : ""}`}><AppText>{item.note}</AppText></Card>)}
      {program.staffNotes.length === 0 && <EmptyState compact icon="document-text-outline" title={t("children.noStaffNotes")} />}
    </View>

    <View style={styles.section}><SectionHeader title={t("children.parentFeedback")} />
      {program.parentFeedback.map((item) => <Card key={item.id} icon="chatbubble-ellipses-outline" subtitle={item.parentName ?? t("common.noData")}><AppText>{item.note}</AppText></Card>)}
      {program.parentFeedback.length === 0 && <EmptyState compact icon="chatbubbles-outline" title={t("children.noFeedback")} />}
    </View>
  </View>
    <BottomSheet visible={sheet === "program"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("common.edit")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("common.save"), loading: updateProgram.isPending, disabled: !name.trim(), onPress: () => void saveProgram() }}>
      <TextField label={t("children.programName")} value={name} onChangeText={setName} />
      <TextField label={t("children.programDescription")} value={description} onChangeText={setDescription} multiline />
      <AppText variant="label">{t("children.programStatus")}</AppText><View style={styles.options}>{programStatuses.map((item) => <Chip key={item} label={statusLabel(item)} selected={status === item} onPress={() => setStatus(item)} />)}</View>
      <ToggleSwitch label={t("children.parentVisible")} description={t("children.parentVisibleDescription")} value={parentVisible} onValueChange={setParentVisible} accessibilityLabel={t("children.parentVisible")} />
      <TextField label={t("children.parentSummary")} value={parentSummary} onChangeText={setParentSummary} multiline />
      <TextField label={t("children.homeGuidance")} value={homeGuidance} onChangeText={setHomeGuidance} multiline />
    </BottomSheet>
    <BottomSheet visible={sheet === "step"} onClose={closeStepForm} closeAccessibilityLabel={t("common.close")} title={t(stepId ? "children.editStep" : "children.addStep")} negativeAction={{ label: t("common.cancel"), onPress: closeStepForm }} positiveAction={{ label: t("common.save"), loading: addStep.isPending || updateStep.isPending, disabled: !stepTitle.trim() || !Number.isFinite(stepOrder) || stepOrder < 0, onPress: () => void saveStep() }}>
      <TextField label={t("children.stepTitle")} value={stepTitle} onChangeText={setStepTitle} />
      <TextField label={t("children.stepDescription")} value={stepDescription} onChangeText={setStepDescription} multiline />
      <TextField label={t("children.homeGuidance")} value={stepHomeGuidance} onChangeText={setStepHomeGuidance} multiline />
      <TextField label={t("learning.order")} inputMode="numeric" value={stepDisplayOrder} onChangeText={setStepDisplayOrder} />
      <ToggleSwitch label={t("children.completed")} value={stepCompleted} onValueChange={setStepCompleted} accessibilityLabel={t("children.completed")} />
      <ToggleSwitch label={t("children.stepParentVisible")} description={program.parentVisible ? undefined : t("children.parentVisibleDescription")} value={stepParentVisible} onValueChange={setStepParentVisible} disabled={!program.parentVisible} accessibilityLabel={t("children.stepParentVisible")} />
    </BottomSheet>
    <BottomSheet visible={sheet === "note"} onClose={() => { setNote(""); setNoteStepId(null); setSheet(null); }} closeAccessibilityLabel={t("common.close")} title={t("children.addStaffNote")} negativeAction={{ label: t("common.cancel"), onPress: () => { setNote(""); setNoteStepId(null); setSheet(null); } }} positiveAction={{ label: t("common.save"), loading: addStaffNote.isPending, disabled: !note.trim(), onPress: () => void saveStaffNote() }}>
      <TextField label={t("children.staffNote")} value={note} onChangeText={setNote} multiline />
      <AppText variant="label">{t("children.steps")}</AppText><View style={styles.options}><Chip label={t("children.programDetail")} selected={noteStepId === null} onPress={() => setNoteStepId(null)} />{program.steps.map((step) => <Chip key={step.id} label={step.title} selected={noteStepId === step.id} onPress={() => setNoteStepId(step.id)} />)}</View>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  section: { gap: spacing.sm },
  grow: { flex: 1 },
  actions: { flexDirection: "row", gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
