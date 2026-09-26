import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChildListFilter, DevelopmentEntryMedia } from "@daycare/api-client";
import { AppText, Avatar, BackButton, Banner, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, MenuItem, SectionHeader, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { AppScreen } from "@/navigation/AppScreen";
import { can } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useCreateDevelopmentEntry, useDevelopmentCategories, useDevelopmentEntries, useDevelopmentEntryMedia, useDevelopmentEntryPhoto } from "@/development/useDevelopment";
import { groupDevelopmentEntries } from "@/development/history";
import { resolveSelectedChildId } from "@/development/selectedChild";
import { useI18n } from "@/i18n/I18nProvider";
import { ChildFilterSheet } from "@/children/ChildFilterSheet";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { useAudioRecording, useAudioPlayback } from "@/audio";
import { encodeLocalFileBase64 } from "@/development/encodeLocalFile";
import { checkInAudioPlaybackUri } from "@/development/checkInAudioUri";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function DevelopmentScreen() {
  const router = useRouter();
  const { childId: routeChildId } = useLocalSearchParams<{ childId?: string }>();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const access = useUiAccessContext(Boolean(membership));
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const hasFixedChild = typeof routeChildId === "string";
  const [filterVisible, setFilterVisible] = useState(false);
  const [childFilter, setChildFilter] = useState<ChildListFilter>({});
  const children = useChildren(isStaffAdmin ? childFilter : {});
  const [childId, setChildId] = useState<string | null>(typeof routeChildId === "string" ? routeChildId : null);
  const [category, setCategory] = useState("OBSERVATION");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entryVisible, setEntryVisible] = useState(false);
  const imagePicker = useImagePicker();
  const audioRecording = useAudioRecording();
  const selectedChild = useMemo(() => children.data?.find((child) => child.id === childId) ?? null, [children.data, childId]);
  const entries = useDevelopmentEntries(childId);
  const developmentCategories = useDevelopmentCategories();
  const createEntry = useCreateDevelopmentEntry(childId);
  const canRecord = membership ? can(membership.role, "recordDevelopment") && membership.active : false;
  const canManageCategories = membership?.active && (membership.role === "STAFF_ADMIN" || (membership.role === "STAFF" && membership.canManageDevelopmentCategories));

  useEffect(() => {
    setChildId((currentChildId) => resolveSelectedChildId(children.data ?? [], currentChildId, hasFixedChild ? routeChildId : undefined, hasFixedChild));
  }, [children.data, hasFixedChild, routeChildId]);

  useEffect(() => {
    if (!developmentCategories.data?.length) return;
    if (!developmentCategories.data.some((item) => item.id === category && item.active)) setCategory(developmentCategories.data.find((item) => item.active)?.id ?? "OBSERVATION");
  }, [category, developmentCategories.data]);

  const selectChild = (nextChildId: string) => setChildId(nextChildId);

  const submit = async () => {
    setEntryError(null);
    try {
      const photoMedia = await Promise.all(photos.map(async (item) => ({
        kind: "PHOTO" as const,
        contentType: item.mimeType === "image/png" ? "image/png" : "image/jpeg",
        dataBase64: await encodeLocalFileBase64(item.uri),
      })));
      const audioMedia = audioRecording.recording ? [{
        kind: "AUDIO" as const,
        contentType: audioRecording.recording.mimeType,
        dataBase64: await encodeLocalFileBase64(audioRecording.recording.uri),
        durationMs: audioRecording.recording.durationMs,
      }] : [];
      await createEntry.mutateAsync({ category, title, content, media: [...photoMedia, ...audioMedia] });
      setTitle("");
      setContent("");
      setPhotos([]);
      imagePicker.clear();
      await audioRecording.clear();
      setEntryVisible(false);
      notify(t("development.saved"), t("development.savedDescription"), "success");
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : t("development.saveFailed"));
    }
  };

  const openEntry = () => {
    setEntryError(null);
    setEntryVisible(true);
  };

  const selectPhoto = async () => { const picked = await imagePicker.pickFromLibrary(); setPhotos((current) => [...current, ...picked]); };
  const takePhoto = async () => {
    const picked = await imagePicker.takePhoto();
    if (picked) setPhotos((current) => [...current, picked]);
  };
  const removePhoto = (index: number) => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const hasChildFilter = Boolean(childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId);
  return <AppScreen showBottomNavigation={false} title={t("development.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={selectedChild && canRecord ? <FloatingActionButton icon="create-outline" accessibilityLabel={t("development.record", { name: selectedChild.fullName })} onPress={openEntry}>{t("development.recordShort")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("development.subtitle")}</AppText>
    {membership?.active === false && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    {!hasFixedChild && <View style={styles.pickerHeader}>
      <AppText variant="label" style={styles.grow}>{t("development.chooseChild")}</AppText>
      {isStaffAdmin && <Button variant={hasChildFilter ? "primary" : "secondary"} accessibilityLabel={t(hasChildFilter ? "children.filterActive" : "children.filter")} leadingIcon={<Ionicons name="options-outline" size={18} color={hasChildFilter ? colors.onPrimary : colors.primary} />} onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}
    </View>}
    {!hasFixedChild && children.isFetching && <ShimmerList variant="tile" />}
    {!hasFixedChild && !children.isFetching && <ChipGroup accessibilityLabel={t("development.chooseChild")}>
      {children.data?.map((child) => <Chip key={child.id} label={child.fullName} selected={child.id === childId} onPress={() => selectChild(child.id)} />)}
    </ChipGroup>}
    {!children.isLoading && !children.data?.length && <EmptyState icon="happy-outline" title={t("children.empty")} />}
    {hasFixedChild && !children.isLoading && Boolean(children.data?.length) && !selectedChild && <EmptyState icon="happy-outline" title={t("children.empty")} />}
    {selectedChild && <Card>
      <View style={styles.childHeader}><Avatar name={selectedChild.fullName} /><AppText variant="h5" style={styles.grow}>{selectedChild.fullName}</AppText></View>
      <View style={styles.quickLinks}>
        {hasAcademicOffering && <QuickLink icon="flag-outline" label={t("goals.title")} onPress={() => router.push({ pathname: "/goals", params: { childId: selectedChild.id } })} />}
        <QuickLink icon="medkit-outline" label={t("health.title")} onPress={() => router.push({ pathname: "/child-health", params: { childId: selectedChild.id } })} />
        <QuickLink icon="bandage-outline" label={t("incident.title")} onPress={() => router.push({ pathname: "/incident-reports", params: { childId: selectedChild.id } })} />
      </View>
    </Card>}
    {canManageCategories && <MenuItem icon="pricetags-outline" title={t("development.categories")} onPress={() => router.push("/development-categories")} />}
    <BottomSheet visible={entryVisible} onClose={() => setEntryVisible(false)} closeAccessibilityLabel={t("common.close")} title={selectedChild ? t("development.record", { name: selectedChild.fullName }) : t("development.title")} negativeAction={{ label: t("common.cancel"), onPress: () => setEntryVisible(false) }} positiveAction={{ label: t("development.share"), loading: createEntry.isPending, disabled: !title.trim() || !content.trim(), onPress: () => void submit() }}>
      {entryError && <Banner tone="danger" title={t("development.saveFailed")} message={entryError !== t("development.saveFailed") ? entryError : undefined} />}
      <View style={styles.field}><AppText variant="label">{t("development.category")}</AppText><ChipGroup accessibilityLabel={t("development.category")}>{developmentCategories.data?.filter((item) => item.active).map((item) => <Chip key={item.id} label={item.name} selected={item.id === category} onPress={() => setCategory(item.id)} />)}</ChipGroup></View>
      <TextField label={t("development.shortTitle")} required value={title} onChangeText={setTitle} maxLength={120} />
      <TextField label={t("development.note")} required multiline hint={t("common.characterCount", { count: content.length, max: 2000 })} value={content} onChangeText={setContent} maxLength={2_000} />
      <View style={styles.field}>
        <AppText variant="label">{t("development.addPhoto")}</AppText>
        <View style={styles.selector}>
          <Button variant="secondary" leadingIcon={<Ionicons name="images-outline" size={18} color={colors.primary} />} onPress={() => void selectPhoto()}>{t("development.uploadPhoto")}</Button>
          <Button variant="secondary" leadingIcon={<Ionicons name="camera-outline" size={18} color={colors.primary} />} onPress={() => void takePhoto()}>{t("development.takePhoto")}</Button>
        </View>
        {photos.length > 0 && <View style={styles.selector}>{photos.map((item, index) => <Pressable key={item.uri} accessibilityRole="button" accessibilityLabel={t("common.delete")} onPress={() => removePhoto(index)} style={styles.thumbnailWrap}>
          <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.removeBadge}><Ionicons name="close" size={14} color={colors.onPrimary} /></View>
        </Pressable>)}</View>}
        {photos.length > 0 && <AppText variant="caption" tone="muted">{t("development.tapToRemove")}</AppText>}
        {imagePicker.error && <Banner tone="danger" title={imagePicker.error.message} />}
      </View>
      <View style={styles.field}>
        <AppText variant="label">{t("development.addAudio")}</AppText>
        {audioRecording.status !== "unsupported" && <View style={styles.selector}>
          {audioRecording.status === "recording"
            ? <Button variant="danger" leadingIcon={<Ionicons name="stop" size={18} color={colors.onPrimary} />} onPress={() => void audioRecording.stop()}>{t("goals.stopRecording")}</Button>
            : <Button variant="secondary" leadingIcon={<Ionicons name="mic-outline" size={18} color={colors.primary} />} onPress={() => void audioRecording.start()}>{t("goals.recordAudio")}</Button>}
        </View>}
        {audioRecording.recording && <AppText tone="muted" variant="caption">{t("goals.audioReady", { seconds: Math.round(audioRecording.recording.durationMs / 1000) })}</AppText>}
        {audioRecording.error && <AppText tone="muted" variant="caption">{audioRecording.error.message}</AppText>}
      </View>
    </BottomSheet>
    {selectedChild && <DevelopmentHistory entries={entries} />}
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} />}
  </AppScreen>;
}

function QuickLink({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quickLink, pressed && styles.thumbnailPressed]}>
    <Ionicons name={icon} size={22} color={colors.primary} />
    <AppText variant="caption" style={styles.quickLinkLabel}>{label}</AppText>
  </Pressable>;
}

function DevelopmentHistory({ entries }: { entries: ReturnType<typeof useDevelopmentEntries> }) {
  const { t, formatDateTime } = useI18n();
  const groups = groupDevelopmentEntries(entries.data ?? []);
  const [photoEntry, setPhotoEntry] = useState<{ id: string; childId: string; title: string } | null>(null);
  const photo = useDevelopmentEntryPhoto(photoEntry?.childId ?? null, photoEntry?.id ?? null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  return <View style={styles.section}>
    <SectionHeader title={t("development.history")} />
    {entries.isFetching && <ShimmerList />}
    {entries.isError && !entries.isFetching && <ErrorState compact title={t("development.loadFailed")} retryLabel={t("common.retry")} onRetry={() => void entries.refetch()} />}
    {!entries.isFetching && groups.map((group) => <View key={group.category} style={styles.categoryGroup}>
      <AppText variant="overline" tone="muted">{group.categoryName.toUpperCase()}</AppText>
      {group.entries.map((entry) => <View key={entry.id} style={styles.entry}>
        <AppText variant="h6">{entry.title}</AppText>
        <AppText>{entry.content}</AppText>
        {entry.hasPhoto && <DevelopmentPhotoThumbnail childId={entry.childId} entryId={entry.id} title={entry.title} onPress={() => setPhotoEntry({ id: entry.id, childId: entry.childId, title: entry.title })} />}
        {entry.media.length > 0 && <View style={styles.selector}>{entry.media.map((item) => <DevelopmentMediaItem key={item.id} childId={entry.childId} entryId={entry.id} media={item} title={entry.title} activeAudioId={activeAudioId} onAudioActivate={setActiveAudioId} />)}</View>}
        <AppText variant="caption" tone="muted">{formatDateTime(entry.recordedAt)} · {entry.recordedBy}</AppText>
      </View>)}
    </View>)}
    {!entries.isFetching && entries.data?.length === 0 && <EmptyState compact icon="sparkles-outline" title={t("development.empty")} />}
    <BottomSheet visible={photoEntry !== null} onClose={() => setPhotoEntry(null)} closeAccessibilityLabel={t("common.close")} title={t("development.photo")}>
      {photo.isFetching && <ShimmerList variant="tile" />}
      {photo.isError && <AppText accessibilityRole="alert" tone="danger">{t("development.photoLoadFailed")}</AppText>}
      {photo.data && <Image source={{ uri: `data:${photo.data.contentType};base64,${photo.data.dataBase64}` }} style={styles.historyPhotoPreview} resizeMode="contain" />}
    </BottomSheet>
  </View>;
}

function DevelopmentMediaItem({ childId, entryId, media, title, activeAudioId, onAudioActivate }: { childId: string; entryId: string; media: DevelopmentEntryMedia; title: string; activeAudioId: string | null; onAudioActivate: (mediaId: string) => void }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const content = useDevelopmentEntryMedia(childId, entryId, expanded ? media.id : null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const playback = useAudioPlayback(audioUri);

  useEffect(() => {
    if (media.kind !== "AUDIO" || !content.data) return;
    void checkInAudioPlaybackUri(content.data.dataBase64).then(setAudioUri);
  }, [content.data, media.kind]);

  useEffect(() => {
    if (activeAudioId !== media.id && playback.status === "playing") playback.pause();
  }, [activeAudioId, media.id, playback]);

  if (media.kind === "AUDIO") {
    if (!expanded) return <Button variant="secondary" onPress={() => setExpanded(true)}>{t("goals.playAudio")}</Button>;
    if (content.isFetching || !audioUri) return <View accessibilityLabel={t("development.photoLoading")} style={styles.thumbnailPlaceholder} />;
    const togglePlayback = () => {
      if (playback.status === "playing") { playback.pause(); return; }
      onAudioActivate(media.id);
      playback.play();
    };
    return <Button variant="secondary" onPress={togglePlayback}>{t(playback.status === "playing" ? "goals.pauseAudio" : "goals.playAudio")}</Button>;
  }

  if (!expanded) return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => setExpanded(true)} style={({ pressed }) => [styles.thumbnailPressable, pressed && styles.thumbnailPressed]}>
    <View style={styles.thumbnailPlaceholder} />
  </Pressable>;
  if (content.isFetching) return <View accessibilityLabel={t("development.photoLoading")} style={styles.thumbnailPlaceholder} />;
  if (!content.data) return null;
  const photoUri = `data:${content.data.contentType};base64,${content.data.dataBase64}`;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t("development.viewPhoto")} onPress={() => setViewerOpen(true)} style={({ pressed }) => [styles.thumbnailPressable, pressed && styles.thumbnailPressed]}>
      <Image accessibilityLabel={title} source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
    </Pressable>
    <BottomSheet visible={viewerOpen} onClose={() => setViewerOpen(false)} closeAccessibilityLabel={t("common.close")} title={title}>
      <Image accessibilityLabel={title} source={{ uri: photoUri }} style={styles.historyPhotoPreview} resizeMode="contain" />
    </BottomSheet>
  </>;
}

function DevelopmentPhotoThumbnail({ childId, entryId, title, onPress }: { childId: string; entryId: string; title: string; onPress: () => void }) {
  const { t } = useI18n();
  const photo = useDevelopmentEntryPhoto(childId, entryId);

  if (photo.isLoading) return <View accessibilityLabel={t("development.photoLoading")} style={styles.thumbnailPlaceholder} />;
  if (!photo.data) return <Button variant="secondary" onPress={onPress}>{t("development.viewPhoto")}</Button>;

  return <Pressable accessibilityRole="button" accessibilityLabel={t("development.viewPhoto")} onPress={onPress} style={({ pressed }) => [styles.thumbnailPressable, pressed && styles.thumbnailPressed]}>
    <Image accessibilityLabel={title} source={{ uri: `data:${photo.data.contentType};base64,${photo.data.dataBase64}` }} style={styles.thumbnail} resizeMode="cover" />
  </Pressable>;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  pickerHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  childHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  quickLinks: { flexDirection: "row", gap: spacing.sm },
  quickLink: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  quickLinkLabel: { textAlign: "center", fontWeight: "700" },
  field: { gap: spacing.sm },
  thumbnailWrap: { borderRadius: radius.sm, overflow: "hidden" },
  removeBadge: { position: "absolute", top: 4, right: 4, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.danger },
  selector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.sm },
  categoryGroup: { gap: spacing.xs },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  entry: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  photoPreview: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  historyPhotoPreview: { width: "100%", height: 360, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  thumbnailPressable: { alignSelf: "flex-start", borderRadius: radius.sm, overflow: "hidden" },
  thumbnailPressed: { opacity: 0.72 },
  thumbnail: { width: 88, height: 88, backgroundColor: colors.surfaceTint },
  thumbnailPlaceholder: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
});
