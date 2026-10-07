import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildMessage } from "@daycare/api-client";
import { AppText, BackButton, Banner, BottomSheet, Button, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { pickedImageUpload } from "@/image-picker/photoUpload";
import { ChildMessagePhoto } from "@/chat/ChildMessagePhoto";
import { useChildMessageTemplates } from "@/chat/useChildMessageTemplates";
import { childMessageNotificationScope } from "@/notifications/childMessageLocalNotificationPolicy";
import { useLocalNotificationScope } from "@/notifications/useLocalNotificationScope";
import { childMessageUnreadSummaryQueryKey } from "@/chat/useChildMessageUnreadSummary";

export default function ChildMessagesScreen() {
  const router = useRouter();
  const { childId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const { api, profile, organizationId: activeOrganizationId } = useAuth();
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canUse = Boolean(membership?.active && ["PARENT", "STAFF", "STAFF_ADMIN"].includes(membership.role));
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChildMessage | null>(null);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const isStaffSide = membership?.role === "STAFF" || membership?.role === "STAFF_ADMIN";
  const templates = useChildMessageTemplates(Boolean(canUse && isStaffSide && organizationId === activeOrganizationId));
  const imagePicker = useImagePicker();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const threadOffset = useRef(0);
  const bubbleRelativeOffsets = useRef<Record<string, number>>({});
  const bubbleOffsets = useRef<Record<string, number>>({});
  const knownMessageIds = useRef<Set<string> | null>(null);
  const initialScrollThreadKey = useRef<string | null>(null);
  const isAtBottom = useRef(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const threadKey = `${organizationId ?? ""}:${childId ?? ""}`;
  useLocalNotificationScope(organizationId && typeof childId === "string" ? childMessageNotificationScope(organizationId, childId) : null);

  const messages = useQuery({ queryKey: ["child-messages", organizationId, childId], queryFn: () => api.childMessages(childId!, organizationId), enabled: Boolean(organizationId && childId && canUse) });
  const send = useMutation({
    mutationFn: async ({ body, replyToMessageId, photo: picked }: { body: string; replyToMessageId?: string; photo?: PickedImage }) => api.sendChildMessage(childId!, body, organizationId, replyToMessageId, picked ? await pickedImageUpload(picked) : undefined),
    onSuccess: () => { setDraft(""); setReplyTo(null); setPhoto(null); setSendError(null); void queryClient.invalidateQueries({ queryKey: ["child-messages", organizationId, childId] }); },
    onError: (error: unknown) => setSendError(error instanceof Error ? error.message : t("childMessage.sendFailed")),
  });

  useEffect(() => {
    knownMessageIds.current = null;
    initialScrollThreadKey.current = null;
    bubbleRelativeOffsets.current = {};
    bubbleOffsets.current = {};
    isAtBottom.current = true;
    setNewMessageCount(0);
  }, [threadKey]);

  useEffect(() => {
    const nextMessages = messages.data;
    if (!nextMessages) return;

    const nextIds = new Set(nextMessages.map((message) => message.id));
    const previousIds = knownMessageIds.current;
    knownMessageIds.current = nextIds;
    if (!previousIds) return;

    const addedMessages = nextMessages.filter((message) => !previousIds.has(message.id));
    if (addedMessages.length === 0) return;

    const ownMessageAdded = addedMessages.some((message) => message.mine);
    const incomingCount = addedMessages.reduce((count, message) => count + (message.mine ? 0 : 1), 0);

    if (ownMessageAdded) {
      requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
      setNewMessageCount(0);
      return;
    }

    if (incomingCount === 0) return;

    if (isAtBottom.current) {
      requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
      setNewMessageCount(0);
    } else {
      setNewMessageCount((count) => count + incomingCount);
    }
  }, [messages.data]);

  // Marking messages read refreshes the Parent and Staff unread badges; a failure here is not worth surfacing to the viewer.
  useEffect(() => {
    if (messages.isSuccess && childId) {
      void api.markChildMessagesRead(childId, organizationId)
        .then(() => Promise.all([
          queryClient.invalidateQueries({ queryKey: ["child-message-summary", organizationId, childId] }),
          queryClient.invalidateQueries({ queryKey: childMessageUnreadSummaryQueryKey(organizationId) }),
        ]))
        .catch(() => undefined);
    }
  }, [api, childId, messages.isSuccess, organizationId, queryClient]);

  if (!profile) return null;
  if (!childId || !canUse) return <Redirect href="/home" />;

  const canSubmit = Boolean(draft.trim() || photo);
  const submit = () => {
    if (!canSubmit) return;
    void send.mutateAsync({ body: draft.trim(), replyToMessageId: replyTo?.id, photo: photo ?? undefined });
  };
  const replySummary = (reply: { body: string; hasPhoto: boolean }) => reply.body || (reply.hasPhoto ? t("childMessage.photo") : "");

  const jumpToMessage = (messageId: string) => {
    const offset = bubbleOffsets.current[messageId];
    if (offset === undefined) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(offset - spacing.md, 0), animated: true });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nextIsAtBottom = distanceFromBottom <= spacing.lg;
    isAtBottom.current = nextIsAtBottom;
    if (nextIsAtBottom) setNewMessageCount(0);
  };

  const handleContentSizeChange = () => {
    if (!messages.data?.length || initialScrollThreadKey.current === threadKey) return;
    initialScrollThreadKey.current = threadKey;
    isAtBottom.current = true;
    requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: false }));
  };

  const scrollToLatest = () => {
    isAtBottom.current = true;
    setNewMessageCount(0);
    requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
  };

  const replyPreview = replyTo && <View style={styles.replyComposer}>
    <View style={styles.replyComposerCopy}>
      <AppText variant="caption" tone="muted">{t("childMessage.replyingTo", { name: replyTo.senderName })}</AppText>
      <AppText numberOfLines={1} tone="muted">{replySummary(replyTo)}</AppText>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t("childMessage.cancelReply")} hitSlop={spacing.sm} onPress={() => setReplyTo(null)} style={styles.cancelReply}>
      <Ionicons name="close" size={18} color={colors.muted} />
    </Pressable>
  </View>;

  const composer = <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.composerFooter}>
    {replyPreview}
    {photo && <View style={styles.photoComposer}>
      <Image source={{ uri: photo.uri }} style={styles.photoComposerPreview} resizeMode="cover" />
      <Pressable accessibilityRole="button" accessibilityLabel={t("childMessage.removePhoto")} hitSlop={spacing.sm} onPress={() => setPhoto(null)} style={styles.cancelReply}>
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </View>}
    <View style={styles.composer}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("childMessage.attachPhoto")} hitSlop={spacing.xs} onPress={() => void imagePicker.pickFromLibrary().then((images) => { if (images[0]) setPhoto(images[0]); })} style={styles.attachButton}>
        <Ionicons name="images-outline" size={22} color={colors.primary} />
      </Pressable>
      {isStaffSide && <Pressable accessibilityRole="button" accessibilityLabel={t("childMessageTemplate.pick")} hitSlop={spacing.xs} onPress={() => setTemplatesOpen(true)} style={styles.attachButton}>
        <Ionicons name="flash-outline" size={22} color={colors.primary} />
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={t("childMessage.takePhoto")} hitSlop={spacing.xs} onPress={() => void imagePicker.takePhoto().then((image) => { if (image) setPhoto(image); })} style={styles.attachButton}>
        <Ionicons name="camera-outline" size={22} color={colors.primary} />
      </Pressable>
      <TextField containerStyle={styles.composerInput} accessibilityLabel={t("childMessage.placeholder")} placeholder={t("childMessage.placeholder")} value={draft} onChangeText={(value) => { setDraft(value); setSendError(null); }} maxLength={2_000} returnKeyType="send" onSubmitEditing={submit} />
      <Button disabled={!canSubmit} loading={send.isPending} onPress={submit}>{t("childMessage.send")}</Button>
    </View>
  </KeyboardAvoidingView>;

  const newMessagesAction = newMessageCount > 0
    ? <FloatingActionButton icon="chevron-down" iconOnly variant="surface" accessibilityLabel={t("childMessage.newMessages", { count: newMessageCount })} onPress={scrollToLatest}>{t("childMessage.newMessages", { count: newMessageCount })}</FloatingActionButton>
    : undefined;

  return <AppScreen showBottomNavigation={false} title={t("childMessage.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} footer={composer} floatingAction={newMessagesAction} scrollViewRef={scrollViewRef} onScroll={handleScroll} onContentSizeChange={handleContentSizeChange}>
    <AppText tone="muted">{t("childMessage.subtitle")}</AppText>
    {messages.isLoading && <ShimmerList />}
    {messages.isError && !messages.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void messages.refetch()} />}
    <View style={styles.thread} onLayout={(event) => { threadOffset.current = event.nativeEvent.layout.y; Object.entries(bubbleRelativeOffsets.current).forEach(([messageId, offset]) => { bubbleOffsets.current[messageId] = threadOffset.current + offset; }); }}>
      {messages.data?.map((message) => <View key={message.id} onLayout={(event) => { bubbleRelativeOffsets.current[message.id] = event.nativeEvent.layout.y; bubbleOffsets.current[message.id] = threadOffset.current + event.nativeEvent.layout.y; }} style={[styles.bubbleRow, message.mine && styles.bubbleRowMine]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("childMessage.replyAction", { name: message.senderName })} onPress={() => setReplyTo(message)} onLongPress={() => setReplyTo(message)} delayLongPress={250} style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther]}>
          {message.replyTo && <Pressable accessibilityRole="button" accessibilityLabel={t("childMessage.jumpToReply", { name: message.replyTo.senderName })} onPress={(event) => { event.stopPropagation(); jumpToMessage(message.replyTo!.id); }} style={[styles.replyPreview, message.mine ? styles.replyPreviewMine : styles.replyPreviewOther]}>
            <AppText variant="caption" style={message.mine ? styles.bubbleTextMine : undefined}>{message.replyTo.senderName}</AppText>
            <AppText numberOfLines={1} tone={message.mine ? undefined : "muted"} style={message.mine ? styles.bubbleTextMine : undefined}>{replySummary(message.replyTo)}</AppText>
          </Pressable>}
          {!message.mine && <AppText variant="caption" tone="muted">{message.senderName}</AppText>}
          {message.hasPhoto && <ChildMessagePhoto childId={childId} messageId={message.id} organizationId={organizationId} />}
          {Boolean(message.body) && <AppText style={message.mine ? styles.bubbleTextMine : undefined}>{message.body}</AppText>}
          <View style={styles.metaRow}>
            <AppText variant="caption" tone={message.mine ? undefined : "muted"} style={message.mine ? styles.bubbleTextMine : undefined}>{formatDateTime(message.createdAt)}</AppText>
            {message.mine && <View style={styles.status}><Ionicons name={message.deliveryStatus === "READ" ? "checkmark-done-outline" : "checkmark-outline"} size={14} color={colors.onPrimary} /><AppText variant="caption" style={styles.bubbleTextMine}>{t(message.deliveryStatus === "READ" ? "childMessage.read" : "childMessage.sent")}</AppText></View>}
          </View>
        </Pressable>
      </View>)}
    </View>
    {!messages.isLoading && !messages.isError && messages.data?.length === 0 && <EmptyState compact icon="chatbubbles-outline" title={t("childMessage.empty")} />}

    {sendError && <Banner tone="danger" title={sendError} />}
    <BottomSheet visible={templatesOpen} onClose={() => setTemplatesOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("childMessageTemplate.pickTitle")}>
      {templates.isFetching && <ShimmerList />}
      {templates.isError && !templates.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void templates.refetch()} />}
      {!templates.isFetching && templates.data?.length === 0 && <EmptyState compact icon="chatbox-ellipses-outline" title={t("childMessageTemplate.pickEmpty")} />}
      {!templates.isFetching && templates.data?.map((template) => <Pressable key={template.id} accessibilityRole="button" accessibilityLabel={template.body} onPress={() => { setDraft((current) => current.trim() ? `${current.trimEnd()} ${template.body}` : template.body); setSendError(null); setTemplatesOpen(false); }} style={styles.templateOption}>
        <AppText>{template.body}</AppText>
      </Pressable>)}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  thread: { gap: spacing.sm },
  bubbleRow: { flexDirection: "row" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "82%", gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  bubbleOther: { backgroundColor: colors.surfaceTint },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTextMine: { color: colors.onPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
  status: { flexDirection: "row", alignItems: "center", gap: 2 },
  replyPreview: { gap: spacing.xs / 2, padding: spacing.xs, borderRadius: radius.sm, borderLeftWidth: 3 },
  replyPreviewMine: { backgroundColor: colors.primaryPressed, borderLeftColor: colors.onPrimary },
  replyPreviewOther: { backgroundColor: colors.surface, borderLeftColor: colors.primary },
  composerFooter: { width: "100%", flexShrink: 0, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: spacing.xs },
  replyComposer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  replyComposerCopy: { flex: 1, minWidth: 0, gap: spacing.xs / 2 },
  cancelReply: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  composer: { width: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm },
  composerInput: { flex: 1, minWidth: 0 },
  templateOption: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  attachButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  photoComposer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  photoComposerPreview: { width: 64, height: 64, borderRadius: radius.sm },
});
