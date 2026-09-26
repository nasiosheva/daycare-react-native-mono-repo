import { useState } from "react";

import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, EmptyState, FloatingActionButton, NavigationCard, ShimmerList, TextField } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function CurriculumActivitiesScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const access = useUiAccessContext(Boolean(membership));
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const activities = useQuery({ queryKey: ["curriculum-activities", organizationId], queryFn: () => api.curriculumActivities(), enabled: hasAcademicOffering });
  const createActivity = useMutation({ mutationFn: api.createCurriculumActivity.bind(api), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["curriculum-activities", organizationId] }) });
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState(""); const [description, setDescription] = useState("");

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  if (!access.isLoading && !hasAcademicOffering) return <Redirect href="/academic" />;

  const close = () => { setFormOpen(false); setName(""); setDescription(""); };
  const openAdd = () => setFormOpen(true);
  const openActivity = (activityId: string) => router.push({ pathname: "/curriculum-activity-detail", params: { activityId } });
  const save = async () => {
    if (!name.trim()) return notify(t("learning.activityRequired"), undefined, "warning");
    try {
      await createActivity.mutateAsync({ name: name.trim(), description: description.trim() });
      close();
    } catch (error) { notify(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); }
  };

  return <AppScreen showBottomNavigation={false} title={t("learning.activities")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton icon="add" accessibilityLabel={t("learning.addActivity")} onPress={openAdd}>{t("learning.addActivity")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("learning.addActivityDescription")}</AppText>

    {activities.isFetching && <ShimmerList variant="tile" />}
    {!activities.isFetching && activities.data?.map((activity) => <NavigationCard key={activity.id} accessibilityLabel={t(canManage ? "learning.editActivity" : "learning.viewActivity")} onPress={() => openActivity(activity.id)}>
      <AppText variant="label">{activity.name}</AppText>{!activity.active && <AppText tone="muted">{t("learning.activityArchived")}</AppText>}
    </NavigationCard>)}
    {!activities.isFetching && activities.data?.length === 0 && <EmptyState compact title={t("learning.noActivities")} />}

    <BottomSheet visible={formOpen} onClose={close} closeAccessibilityLabel={t("common.close")} title={t("learning.addActivity")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("learning.addActivity"), loading: createActivity.isPending, onPress: () => void save() }}>
      <TextField label={t("learning.activityName")} value={name} onChangeText={setName} />
      <TextField label={t("academic.description")} value={description} onChangeText={setDescription} />
    </BottomSheet>
  </AppScreen>;
}
