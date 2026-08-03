import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, BackButton, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { pricingOptions } from "@/private-tutoring/pricingOptions";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function PrivateTutoringAdminScreen() {
  const router = useRouter(); const { api, profile, organizationId } = useAuth(); const { t, formatCurrency } = useI18n(); const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const canUsePrivateTutoring = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const services = useQuery({ queryKey: ["private-tutoring-admin-services", organizationId], queryFn: () => api.privateTutoringServices(), enabled: membership?.role === "STAFF_ADMIN" && canUsePrivateTutoring });
  const tutors = useQuery({ queryKey: ["private-tutoring-tutors", organizationId], queryFn: () => api.privateTutors(), enabled: membership?.role === "STAFF_ADMIN" && canUsePrivateTutoring });
  const requests = useQuery({ queryKey: ["private-tutoring-admin-requests", organizationId], queryFn: () => api.privateTutoringRequests(), enabled: membership?.role === "STAFF_ADMIN" && canUsePrivateTutoring });
  if (!profile) return null; if (membership?.role !== "STAFF_ADMIN" || (!access.isLoading && !canUsePrivateTutoring)) return <Redirect href="/home" />;
  return <AppScreen showBottomNavigation={false} title={t("privateTutoring.adminTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText tone="muted">{t("privateTutoring.adminDescription")}</AppText><View style={styles.row}><Button disabled={membership.active === false} onPress={() => router.push("/private-tutoring-service-form")}>{t("privateTutoring.addService")}</Button><Button disabled={membership.active === false} variant="secondary" onPress={() => router.push("/private-tutor-form")}>{t("privateTutoring.addTutor")}</Button></View>
    <AppText variant="heading">{t("privateTutoring.services")}</AppText>{services.isFetching && <ShimmerList />}{services.data?.map((service) => <NavigationCard key={service.id} accessibilityLabel={service.name} onPress={() => router.push({ pathname: "/private-tutoring-service-form", params: { serviceId: service.id } })}><AppText variant="h5">{service.name}</AppText>{pricingOptions(service).map((option) => <AppText key={option.type} tone="muted">{formatCurrency(option.price)} · {t(servicePlanTypeKey(option.type))}</AppText>)}<AppText tone="muted">{t("privateTutoring.duration", { count: service.durationMinutes })}</AppText><AppText variant="caption" tone="muted">{service.active ? t("privateTutoring.active") : t("privateTutoring.inactive")}</AppText></NavigationCard>)}{!services.isFetching && services.data?.length === 0 && <AppText tone="muted">{t("privateTutoring.noServices")}</AppText>}
    <AppText variant="heading">{t("privateTutoring.tutors")}</AppText>{tutors.data?.map((tutor) => <NavigationCard key={tutor.id} accessibilityLabel={tutor.displayName} onPress={() => router.push({ pathname: "/private-tutor-form", params: { tutorId: tutor.id } })}><AppText variant="h5">{tutor.displayName}</AppText><AppText tone="muted">{tutor.bio}</AppText></NavigationCard>)}{!tutors.isFetching && tutors.data?.length === 0 && <AppText tone="muted">{t("privateTutoring.noTutors")}</AppText>}
    <AppText variant="heading">{t("privateTutoring.requestsAdmin")}</AppText>{requests.data?.filter((item) => item.status === "PENDING_APPROVAL").map((request) => <NavigationCard key={request.id} accessibilityLabel={request.serviceName} onPress={() => router.push({ pathname: "/private-tutoring-decision", params: { requestId: request.id } })}><AppText variant="h5">{request.serviceName} · {request.childName}</AppText><AppText tone="muted">{formatCurrency(request.price)} · {t(servicePlanTypeKey(request.pricingType))}</AppText></NavigationCard>)}{!requests.isFetching && !requests.data?.some((item) => item.status === "PENDING_APPROVAL") && <AppText tone="muted">{t("privateTutoring.noPendingRequests")}</AppText>}
  </View></AppScreen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.md }, row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, card: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border } });
