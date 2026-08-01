import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChildListFilter, DevelopmentEntryMedia } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
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

export default function DevelopmentScreen() {
  const router = useRouter();
  const { childId: routeChildId } = useLocalSearchParams<{ childId?: string }>();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
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

  const selectChild = (nextChildId: string) => {
    setChildId(nextChildId);
    router.setParams({ childId: nextChildId });
  };

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
      Alert.alert(t("development.saved"), t("development.savedDescription"));
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

  return <AppScreen showBottomNavigation={false} title={t("development.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("development.subtitle")}</AppText>
    {membership?.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {isStaffAdmin && <Button variant="secondary" onPress={() => setFilterVisible(true)}>{t("children.filter")}</Button>}
    {isStaffAdmin && (childFilter.branchId || childFilter.learningLevelId || childFilter.classroomId) && <AppText tone="muted">{t("children.filterActive")}</AppText>}
    {hasFixedChild && selectedChild && <AppText variant="heading">{selectedChild.fullName}</AppText>}
    {!hasFixedChild && children.isFetching && <ShimmerList variant="tile" />}
    {!hasFixedChild && !children.isFetching && <View style={styles.selector}>
      {children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => selectChild(child.id)}>{child.fullName}</Button>)}
    </View>}
    {hasFixedChild && !children.isLoading && !selectedChild && <AppText tone="muted">{t("children.empty")}</AppText>}
    {selectedChild && <Button variant="secondary" onPress={() => router.push({ pathname: "/goals", params: { childId: selectedChild.id } })}>{t("goals.title")}</Button>}
    {selectedChild && <Button variant="secondary" onPress={() => router.push({ pathname: "/child-health", params: { childId: selectedChild.id } })}>{t("health.title")}</Button>}
    {selectedChild && <Button variant="secondary" onPress={() => router.push({ pathname: "/incident-reports", params: { childId: selectedChild.id } })}>{t("incident.title")}</Button>}
    {canManageCategories && <Button variant="secondary" onPress={() => router.push("/development-categories")}>{t("development.categories")}</Button>}
    {selectedChild && canRecord && <Button onPress={openEntry}>{t("development.record", { name: selectedChild.fullName })}</Button>}
    <BottomSheet visible={entryVisible} onClose={() => setEntryVisible(false)} closeAccessibilityLabel={t("common.close")} title={selectedChild ? t("development.record", { name: selectedChild.fullName }) : t("development.title")} negativeAction={{ label: t("common.cancel"), onPress: () => setEntryVisible(false) }} positiveAction={{ label: t("development.share"), loading: createEntry.isPending, disabled: !title.trim() || !content.trim(), onPress: () => void submit() }}>
      <View style={styles.selector}>{developmentCategories.data?.filter((item) => item.active).map((item) => <Button key={item.id} variant={item.id === category ? "primary" : "secondary"} onPress={() => setCategory(item.id)}>{item.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("development.shortTitle")} value={title} onChangeText={setTitle} maxLength={120} />
      <TextInput style={[styles.input, styles.contentInput]} placeholder={t("development.note")} value={content} onChangeText={setContent} multiline maxLength={2_000} textAlignVertical="top" />
      <AppText variant="label">{t("development.addPhoto")}</AppText>
      <View style={styles.selector}>
        <Button variant="secondary" onPress={() => void selectPhoto()}>{t("development.uploadPhoto")}</Button>
        <Button variant="secondary" onPress={() => void takePhoto()}>{t("development.takePhoto")}</Button>
      </View>
      {photos.length > 0 && <View style={styles.selector}>{photos.map((item, index) => <Pressable key={item.uri} accessibilityRole="button" accessibilityLabel={t("common.delete")} onPress={() => removePhoto(index)}>
        <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />
      </Pressable>)}</View>}
      {imagePicker.error && <AppText accessibilityRole="alert" tone="danger">{imagePicker.error.message}</AppText>}
      <AppText variant="label">{t("development.addAudio")}</AppText>
      {audioRecording.status !== "unsupported" && <View style={styles.selector}>
        {audioRecording.status === "recording"
          ? <Button variant="secondary" onPress={() => void audioRecording.stop()}>{t("goals.stopRecording")}</Button>
          : <Button variant="secondary" onPress={() => void audioRecording.start()}>{t("goals.recordAudio")}</Button>}
      </View>}
      {audioRecording.recording && <AppText tone="muted" variant="caption">{t("goals.audioReady", { seconds: Math.round(audioRecording.recording.durationMs / 1000) })}</AppText>}
      {audioRecording.error && <AppText tone="muted" variant="caption">{audioRecording.error.message}</AppText>}
      {entryError && <AppText accessibilityRole="alert" tone="danger">{entryError}</AppText>}
    </BottomSheet>
    {selectedChild && <DevelopmentHistory entries={entries} />}
    {isStaffAdmin && <ChildFilterSheet visible={filterVisible} filter={childFilter} onClose={() => setFilterVisible(false)} onApply={(filter) => { setChildFilter(filter); setFilterVisible(false); }} />}
  </AppScreen>;
}

function DevelopmentHistory({ entries }: { entries: ReturnType<typeof useDevelopmentEntries> }) {
  const { t, formatDateTime } = useI18n();
  const groups = groupDevelopmentEntries(entries.data ?? []);
  const [photoEntry, setPhotoEntry] = useState<{ id: string; childId: string; title: string } | null>(null);
  const photo = useDevelopmentEntryPhoto(photoEntry?.childId ?? null, photoEntry?.id ?? null);
  return <View style={styles.section}>
    <AppText variant="heading">{t("development.history")}</AppText>
    {entries.isFetching && <ShimmerList />}
    {entries.isError && <View style={styles.feedback}><AppText accessibilityRole="alert" tone="danger">{t("development.loadFailed")}</AppText><Button variant="secondary" onPress={() => entries.refetch()}>{t("common.retry")}</Button></View>}
    {!entries.isFetching && groups.map((group) => <View key={group.category} style={styles.categoryGroup}>
      <AppText variant="label">{group.categoryName}</AppText>
      {group.entries.map((entry) => <View key={entry.id} style={styles.entry}>
        <AppText variant="label">{entry.title}</AppText>
        <AppText>{entry.content}</AppText>
        {entry.hasPhoto && <DevelopmentPhotoThumbnail childId={entry.childId} entryId={entry.id} title={entry.title} onPress={() => setPhotoEntry({ id: entry.id, childId: entry.childId, title: entry.title })} />}
        {entry.media.length > 0 && <View style={styles.selector}>{entry.media.map((item) => <DevelopmentMediaItem key={item.id} childId={entry.childId} entryId={entry.id} media={item} title={entry.title} />)}</View>}
        <AppText variant="caption" tone="muted">{formatDateTime(entry.recordedAt)} · {entry.recordedBy}</AppText>
      </View>)}
    </View>)}
    {!entries.isFetching && entries.data?.length === 0 && <AppText tone="muted">{t("development.empty")}</AppText>}
    <BottomSheet visible={photoEntry !== null} onClose={() => setPhotoEntry(null)} closeAccessibilityLabel={t("common.close")} title={t("development.photo")}>
      {photo.isFetching && <ShimmerList variant="tile" />}
      {photo.isError && <AppText accessibilityRole="alert" tone="danger">{t("development.photoLoadFailed")}</AppText>}
      {photo.data && <Image source={{ uri: `data:${photo.data.contentType};base64,${photo.data.dataBase64}` }} style={styles.historyPhotoPreview} resizeMode="contain" />}
    </BottomSheet>
  </View>;
}

function DevelopmentMediaItem({ childId, entryId, media, title }: { childId: string; entryId: string; media: DevelopmentEntryMedia; title: string }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const content = useDevelopmentEntryMedia(childId, entryId, expanded ? media.id : null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const playback = useAudioPlayback(audioUri);

  useEffect(() => {
    if (media.kind !== "AUDIO" || !content.data) return;
    void checkInAudioPlaybackUri(content.data.dataBase64).then(setAudioUri);
  }, [content.data, media.kind]);

  if (media.kind === "AUDIO") {
    if (!expanded) return <Button variant="secondary" onPress={() => setExpanded(true)}>{t("goals.playAudio")}</Button>;
    if (content.isFetching || !audioUri) return <View accessibilityLabel={t("development.photoLoading")} style={styles.thumbnailPlaceholder} />;
    return <Button variant="secondary" onPress={() => playback.status === "playing" ? playback.pause() : playback.play()}>{t(playback.status === "playing" ? "goals.pauseAudio" : "goals.playAudio")}</Button>;
  }

  if (!expanded) return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => setExpanded(true)} style={({ pressed }) => [styles.thumbnailPressable, pressed && styles.thumbnailPressed]}>
    <View style={styles.thumbnailPlaceholder} />
  </Pressable>;
  if (content.isFetching) return <View accessibilityLabel={t("development.photoLoading")} style={styles.thumbnailPlaceholder} />;
  if (!content.data) return null;
  return <Image accessibilityLabel={title} source={{ uri: `data:${content.data.contentType};base64,${content.data.dataBase64}` }} style={styles.thumbnail} resizeMode="cover" />;
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
  selector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.sm },
  categoryGroup: { gap: spacing.xs },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface },
  contentInput: { minHeight: 120, paddingTop: 12 },
  entry: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  feedback: { gap: spacing.sm },
  photoPreview: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  historyPhotoPreview: { width: "100%", height: 360, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  thumbnailPressable: { alignSelf: "flex-start", borderRadius: radius.sm, overflow: "hidden" },
  thumbnailPressed: { opacity: 0.72 },
  thumbnail: { width: 88, height: 88, backgroundColor: colors.surfaceTint },
  thumbnailPlaceholder: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
});
