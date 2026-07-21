import { Redirect, router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText, Button, Screen, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { can } from "@daycare/core";
import { strings } from "@/i18n/strings";

export default function HomeScreen() {
  const { user, profile, organizationId, signOut } = useAuth();
  if (!user) return <Redirect href="/sign-in" />;
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  if (!membership) return <Screen><AppText variant="heading">Akun Anda belum memiliki akses daycare.</AppText></Screen>;
  return <Screen><View style={styles.content}>
    <AppText variant="title">Halo, {profile?.displayName}</AppText>
    <AppText tone="muted">{membership.organizationName} · {membership.role}</AppText>
    {can(membership.role, "recordAttendance") && <Button onPress={() => router.push("/attendance")}>{strings.attendance}</Button>}
    {can(membership.role, "manageChildren") && <Button variant="secondary" onPress={() => router.push("/children")}>{strings.children}</Button>}
    {can(membership.role, "viewChildDevelopment") && <Button variant="secondary" onPress={() => router.push("/development")}>{strings.development}</Button>}
    {can(membership.role, "viewOwnChildren") && <Button onPress={() => router.push("/parent-qr")}>{strings.showQr}</Button>}
    {can(membership.role, "bookServices") && <Button onPress={() => router.push("/booking")}>{strings.booking}</Button>}
    {can(membership.role, "approveBookings") && <Button onPress={() => router.push("/booking-approvals")}>Persetujuan booking</Button>}
    {can(membership.role, "manageServicePlans") && <Button variant="secondary" onPress={() => router.push("/billing-admin")}>Paket dan tagihan</Button>}
    <Button variant="ghost" onPress={() => void signOut()}>{strings.signOut}</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.md } });
