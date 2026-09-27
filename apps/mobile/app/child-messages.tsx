import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Banner, Button, EmptyState, ErrorState, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

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

  const messages = useQuery({ queryKey: ["child-messages", organizationId, childId], queryFn: () => api.childMessages(childId!, organizationId), enabled: Boolean(organizationId && childId && canUse) });
  const send = useMutation({
    mutationFn: (body: string) => api.sendChildMessage(childId!, body, organizationId),
    onSuccess: () => { setDraft(""); setSendError(null); void queryClient.invalidateQueries({ queryKey: ["child-messages", organizationId, childId] }); },
    onError: (error: unknown) => setSendError(error instanceof Error ? error.message : t("childMessage.sendFailed")),
  });

  // Marking messages read is bookkeeping for a future unread badge; a failure here is not worth surfacing to the viewer.
  useEffect(() => {
    if (messages.isSuccess && childId) void api.markChildMessagesRead(childId, organizationId).catch(() => undefined);
  }, [api, childId, messages.isSuccess, organizationId]);

  if (!profile) return null;
  if (!childId || !canUse) return <Redirect href="/home" />;

  const submit = () => {
    if (!draft.trim()) return;
    void send.mutateAsync(draft.trim());
  };

  return <AppScreen showBottomNavigation={false} title={t("childMessage.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("childMessage.subtitle")}</AppText>
    {messages.isLoading && <ShimmerList />}
    {messages.isError && !messages.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void messages.refetch()} />}
    <View style={styles.thread}>
      {messages.data?.map((message) => <View key={message.id} style={[styles.bubbleRow, message.mine && styles.bubbleRowMine]}>
        <View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!message.mine && <AppText variant="caption" tone="muted">{message.senderName}</AppText>}
          <AppText style={message.mine ? styles.bubbleTextMine : undefined}>{message.body}</AppText>
          <AppText variant="caption" tone={message.mine ? undefined : "muted"} style={message.mine ? styles.bubbleTextMine : undefined}>{formatDateTime(message.createdAt)}</AppText>
        </View>
      </View>)}
    </View>
    {!messages.isLoading && !messages.isError && messages.data?.length === 0 && <EmptyState compact icon="chatbubbles-outline" title={t("childMessage.empty")} />}

    {sendError && <Banner tone="danger" title={sendError} />}
    <View style={styles.composer}>
      <TextField containerStyle={styles.composerInput} accessibilityLabel={t("childMessage.placeholder")} placeholder={t("childMessage.placeholder")} multiline value={draft} onChangeText={(value) => { setDraft(value); setSendError(null); }} maxLength={2_000} />
      <Button disabled={!draft.trim()} loading={send.isPending} onPress={submit}>{t("childMessage.send")}</Button>
    </View>
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
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  composerInput: { flex: 1 },
});
