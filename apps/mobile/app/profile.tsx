import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BackButton, BottomSheet, Button, colors, PasswordInput, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";
import { AppScreen } from "@/navigation/AppScreen";

type ProfileSheet = "profile" | "password" | "admin" | null;

export default function ProfileScreen() {
  const router = useRouter();
  const { api, user, profile, organizationId, isSimulationSession, signOut, updateDisplayName, changePassword, selectOrganization } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const parentMemberships = profile?.memberships.filter((item) => item.role === "PARENT") ?? [];
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [profileSheet, setProfileSheet] = useState<ProfileSheet>(null);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => { setDisplayName(profile?.displayName ?? user?.displayName ?? ""); }, [profile?.displayName, user?.displayName]);

  const leave = async () => {
    try {
      setLeaving(true);
      await signOut();
      router.replace("/sign-in");
    } catch (error) { Alert.alert(t("profile.signOutFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setLeaving(false); }
  };
  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      await updateDisplayName(displayName);
      setProfileSheet(null);
      Alert.alert(t("profile.saved"));
    } catch (error) { Alert.alert(t("profile.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setSavingProfile(false); }
  };
  const savePassword = async () => {
    if (newPassword.length < 6) return Alert.alert(t("password.minLength"));
    if (newPassword !== passwordConfirmation) return Alert.alert(t("password.mismatch"));
    try {
      setSavingPassword(true);
      await changePassword(newPassword);
      setNewPassword("");
      setPasswordConfirmation("");
      setProfileSheet(null);
      Alert.alert(t("password.changed"));
    } catch (error) { Alert.alert(t("password.changeFailed"), error instanceof Error ? error.message : t("password.reauthenticate")); }
    finally { setSavingPassword(false); }
  };
  const createAdmin = async () => {
    if (!adminEmail.trim() || !adminUsername.trim() || !adminPassword) return Alert.alert(t("profile.adminRequired"));
    if (adminPassword.length < 6) return Alert.alert(t("password.minLength"));
    try {
      setCreatingAdmin(true);
      await api.createPlatformAdmin({ email: adminEmail.trim(), username: adminUsername.trim(), password: adminPassword });
      setAdminEmail("");
      setAdminUsername("");
      setAdminPassword("");
      setProfileSheet(null);
      Alert.alert(t("profile.adminCreated"), t("profile.adminCreatedDescription"));
    } catch (error) { Alert.alert(t("profile.adminCreateFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setCreatingAdmin(false); }
  };

  return <AppScreen showBottomNavigation={!isStaffAdmin} title={isStaffAdmin ? t("profile.title") : undefined} header={isStaffAdmin ? <BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} /> : undefined}>
    {!isStaffAdmin && <AppText variant="title">{t("profile.title")}</AppText>}
    <View style={styles.card}>
      <AppText variant="heading">{profile?.displayName ?? user?.displayName ?? t("common.noData")}</AppText>
      {user?.email && <AppText tone="muted">{user.email}</AppText>}
      {user?.phoneNumber && <AppText tone="muted">{user.phoneNumber}</AppText>}
      {profile?.isPlatformAdmin && <AppText tone="muted">{t("profile.rolePlatform")}</AppText>}
      {membership && <>
        <AppText>{membership.organizationName}</AppText>
        <AppText tone="muted">{t("profile.roleTenant", { role: t(roleKey(membership.role)) })}</AppText>
      </>}
      {isSimulationSession && <AppText variant="caption" tone="muted">{t("profile.simulation")}</AppText>}
    </View>

    {parentMemberships.length > 0 && <View style={styles.form}>
      <AppText variant="heading">{t("profile.tenants")}</AppText>
      {parentMemberships.map((item) => <Button key={item.organizationId} variant={item.organizationId === organizationId ? "primary" : "secondary"} onPress={() => { selectOrganization(item.organizationId); router.replace("/home"); }}>{item.organizationName}</Button>)}
      <Button variant="secondary" onPress={() => router.push("/parent-enrollment" as never)}>{t("profile.manageTenants")}</Button>
      <Button variant="secondary" onPress={() => router.push("/parent-qr")}>{t("profile.showQr")}</Button>
    </View>}

    <View style={styles.form}>
      <AppText variant="heading">{t("profile.personal")}</AppText>
      <LanguageSwitcher compact />
      {organizationId && <Button variant="secondary" onPress={() => router.push("/notifications" as never)}>{t("profile.notifications")}</Button>}
      <Button variant="secondary" onPress={() => setProfileSheet("profile")}>{t("profile.savePersonal")}</Button>
      <Button variant="secondary" disabled={isSimulationSession} onPress={() => setProfileSheet("password")}>{t("profile.changePassword")}</Button>
      {isSimulationSession && <AppText variant="caption" tone="muted">{t("profile.passwordSimulation")}</AppText>}
      {profile?.isPlatformAdmin && <Button variant="secondary" onPress={() => setProfileSheet("admin")}>{t("profile.addAdmin")}</Button>}
    </View>

    {profile?.isPlatformAdmin && <Button variant="secondary" onPress={() => router.push("/admin-pin")}>{t("profile.changePin")}</Button>}

    <Button variant="danger" onPress={() => setLogoutSheetVisible(true)}>{t("auth.signOut")}</Button>
    <BottomSheet
      visible={logoutSheetVisible}
      onClose={() => setLogoutSheetVisible(false)}
      closeAccessibilityLabel={t("common.close")}
      title={t("profile.signOutTitle")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setLogoutSheetVisible(false) }}
      positiveAction={{ label: t("auth.signOut"), variant: "danger", loading: leaving, onPress: () => void leave() }}
    >
      <AppText>{t("profile.signOutConfirm")}</AppText>
    </BottomSheet>
    <BottomSheet
      visible={profileSheet === "profile"}
      onClose={() => setProfileSheet(null)}
      closeAccessibilityLabel={t("common.close")}
      title={t("profile.personal")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setProfileSheet(null) }}
      positiveAction={{ label: t("common.save"), loading: savingProfile, disabled: !displayName.trim(), onPress: () => void saveProfile() }}
    >
      <TextInput style={styles.input} placeholder={t("profile.name")} value={displayName} onChangeText={setDisplayName} />
    </BottomSheet>
    <BottomSheet
      visible={profileSheet === "password"}
      onClose={() => setProfileSheet(null)}
      closeAccessibilityLabel={t("common.close")}
      title={t("profile.changePassword")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setProfileSheet(null) }}
      positiveAction={{ label: t("common.save"), loading: savingPassword, disabled: !newPassword || !passwordConfirmation, onPress: () => void savePassword() }}
    >
      <PasswordInput placeholder={t("password.new")} value={newPassword} onChangeText={setNewPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
      <PasswordInput placeholder={t("password.confirm")} value={passwordConfirmation} onChangeText={setPasswordConfirmation} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </BottomSheet>
    <BottomSheet
      visible={profileSheet === "admin"}
      onClose={() => setProfileSheet(null)}
      closeAccessibilityLabel={t("common.close")}
      title={t("profile.addAdmin")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setProfileSheet(null) }}
      positiveAction={{ label: t("profile.createAdmin"), loading: creatingAdmin, disabled: !adminEmail.trim() || !adminUsername.trim() || !adminPassword, onPress: () => void createAdmin() }}
    >
      <AppText variant="caption" tone="muted">{t("profile.addAdminDescription")}</AppText>
      <TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder={t("profile.adminEmail")} value={adminEmail} onChangeText={setAdminEmail} />
      <TextInput style={styles.input} placeholder={t("profile.adminUsername")} value={adminUsername} onChangeText={setAdminUsername} />
      <PasswordInput placeholder={t("password.new")} value={adminPassword} onChangeText={setAdminPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
