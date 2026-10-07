import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildMessageTemplate } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, EmptyState, ErrorState, FloatingActionButton, NavigationCard, ShimmerList, TextField, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { childMessageTemplatesQueryKey, CHILD_MESSAGE_TEMPLATE_MAX_LENGTH } from "@/chat/useChildMessageTemplates";

/** Staff Admin management of tenant-wide chat quick replies. */
export default function ChildMessageTemplatesScreen() {
  const router = useRouter();
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const templates = useQuery({ queryKey: childMessageTemplatesQueryKey(organizationId), queryFn: () => api.childMessageTemplates(), enabled: Boolean(canManage) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChildMessageTemplate | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(false); setEditing(null); setBody(""); setError(null); };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: childMessageTemplatesQueryKey(organizationId) });
  const save = useMutation({
    mutationFn: () => editing ? api.updateChildMessageTemplate(editing.id, body.trim()) : api.createChildMessageTemplate(body.trim()),
    onSuccess: () => { refresh(); close(); },
    onError: (value) => setError(value instanceof Error ? value.message : t("childMessageTemplate.saveFailed")),
  });
  const remove = useMutation({
    mutationFn: (template: ChildMessageTemplate) => api.deleteChildMessageTemplate(template.id),
    onSuccess: () => { refresh(); close(); },
    onError: (value) => setError(value instanceof Error ? value.message : t("childMessageTemplate.deleteFailed")),
  });
  const openCreate = () => { setEditing(null); setBody(""); setError(null); setOpen(true); };
  const openEdit = (template: ChildMessageTemplate) => { setEditing(template); setBody(template.body); setError(null); setOpen(true); };

  if (!profile) return null;
  if (!canManage) return <Redirect href="/home" />;
  return <AppScreen
    showBottomNavigation={false}
    title={t("childMessageTemplate.title")}
    header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}
    floatingAction={<FloatingActionButton icon="add" accessibilityLabel={t("childMessageTemplate.add")} onPress={openCreate}>{t("childMessageTemplate.add")}</FloatingActionButton>}
  >
    <View style={styles.content}>
      <AppText tone="muted">{t("childMessageTemplate.subtitle")}</AppText>
      {templates.isFetching && <ShimmerList />}
      {templates.isError && !templates.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void templates.refetch()} />}
      {!templates.isFetching && Boolean(templates.data?.length) && <AppText variant="label">{t("childMessageTemplate.count", { count: templates.data!.length })}</AppText>}
      {!templates.isFetching && templates.data?.map((template) => <NavigationCard key={template.id} accessibilityLabel={`${t("childMessageTemplate.edit")}: ${template.body}`} onPress={() => openEdit(template)}>
        <AppText>{template.body}</AppText>
      </NavigationCard>)}
      {!templates.isFetching && !templates.isError && templates.data?.length === 0 && <EmptyState compact icon="chatbox-ellipses-outline" title={t("childMessageTemplate.empty")} action={{ label: t("childMessageTemplate.add"), onPress: openCreate }} />}
    </View>
    <BottomSheet
      visible={open}
      onClose={close}
      closeAccessibilityLabel={t("common.close")}
      title={editing ? t("childMessageTemplate.edit") : t("childMessageTemplate.add")}
      negativeAction={editing
        ? { label: t("childMessageTemplate.delete"), variant: "danger", loading: remove.isPending, disabled: save.isPending, onPress: () => remove.mutate(editing) }
        : { label: t("common.cancel"), onPress: close }}
      positiveAction={{ label: t("childMessageTemplate.save"), loading: save.isPending, disabled: !body.trim() || remove.isPending, onPress: () => save.mutate() }}
    >
      {error && <AppText tone="danger">{error}</AppText>}
      <TextField label={t("childMessageTemplate.body")} required multiline value={body} onChangeText={setBody} maxLength={CHILD_MESSAGE_TEMPLATE_MAX_LENGTH} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
});
