import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { ChildGender } from "@daycare/core";
import { AppText, Avatar, Badge, BackButton, BottomSheet, Button, Card, InfoRow, MenuItem, MenuSection, PasswordInput, TextField, spacing } from "@daycare/ui";
import { notify } from "@/notify/notify";
import { useAuth } from "@/auth/AuthProvider";
import { GenderPicker } from "@/children/GenderPicker";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";
import { AppScreen } from "@/navigation/AppScreen";
import { installedAppVersionInfo } from "@/app-version/nativeAppVersionInfo";
import { LanguageSelectField } from "@/profile/LanguageSelectField";
import { capitalizeWords } from "@/text/capitalizeWords";

type ProfileSheet = "profile" | "password" | null;
const copyrightYear = new Date().getFullYear();

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, organizationId, signOut, updateDisplayName, updateUsername, updatePersonalDetails, changePassword, usesPassword, selectOrganization } = useAuth();
  const { t, formatDate } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isStaffAdmin = membership?.role === "STAFF_ADMIN";
  const parentMemberships = profile?.memberships.filter((item) => item.role === "PARENT") ?? [];
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<ChildGender | undefined>(undefined);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSheet, setProfileSheet] = useState<ProfileSheet>(null);
  const [tenantSheetOpen, setTenantSheetOpen] = useState(false);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => { setDisplayName(profile?.displayName ?? user?.displayName ?? ""); }, [profile?.displayName, user?.displayName]);
  useEffect(() => { setUsername(profile?.username ?? ""); }, [profile?.username]);
  useEffect(() => { setGender(profile?.gender && profile.gender !== "UNSPECIFIED" ? profile.gender : undefined); }, [profile?.gender]);
  useEffect(() => { setDateOfBirth(profile?.dateOfBirth ?? ""); }, [profile?.dateOfBirth]);

  const leave = () => {
    setLeaving(true);
    void signOut();
    // Clear every pushed screen first so hardware/gesture back from sign-in
    // never pops into a now-unauthenticated screen left behind it. Guarded
    // because dismissAll() on an empty stack logs a dev-only console error.
    if (router.canDismiss()) router.dismissAll();
    router.replace("/sign-in");
  };
  const saveProfile = async () => {
    if (!gender || !isIsoDate(dateOfBirth)) return;
    try {
      setSavingProfile(true);
      await updateDisplayName(displayName);
      await updateUsername(username);
      await updatePersonalDetails(gender, dateOfBirth);
      setProfileSheet(null);
      notify(t("profile.saved"), undefined, "success");
    } catch (error) { notify(t("profile.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"); }
    finally { setSavingProfile(false); }
  };
  const savePassword = async () => {
    if (newPassword.length < 6) return notify(t("password.minLength"), undefined, "warning");
    if (newPassword !== passwordConfirmation) return notify(t("password.mismatch"), undefined, "warning");
    try {
      setSavingPassword(true);
      await changePassword(newPassword);
      setNewPassword("");
      setPasswordConfirmation("");
      setProfileSheet(null);
      notify(t("password.changed"), undefined, "success");
    } catch (error) { notify(t("password.changeFailed"), error instanceof Error ? error.message : t("password.reauthenticate"), "danger"); }
    finally { setSavingPassword(false); }
  };
  return <AppScreen showBottomNavigation={false} title={t("profile.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <Card>
      <View style={styles.hero}>
        <Avatar name={profile?.displayName ?? user?.displayName ?? "?"} size="lg" />
        <View style={styles.grow}>
          <AppText variant="h4">{profile?.displayName ?? user?.displayName ?? t("common.noData")}</AppText>
          {membership && <AppText tone="muted">{membership.organizationName}</AppText>}
          {membership && <Badge tone="info" label={t(roleKey(membership.role))} />}
          {profile?.isPlatformAdmin && <Badge tone="info" label={t("profile.rolePlatform")} />}
        </View>
      </View>
      {user?.email && <InfoRow icon="mail-outline" label={t("auth.email")} value={user.email} />}
      {profile?.username && <InfoRow icon="at-outline" label={t("profile.username")} value={profile.username} />}
      {user?.phoneNumber && <InfoRow icon="call-outline" label={t("auth.phone")} value={user.phoneNumber} />}
      {profile?.dateOfBirth && <InfoRow icon="calendar-outline" label={t("profile.dateOfBirth")} value={`${formatDate(profile.dateOfBirth)}${profile.gender && profile.gender !== "UNSPECIFIED" ? ` · ${t(profile.gender === "MALE" ? "children.genderMale" : "children.genderFemale")}` : ""}`} />}
    </Card>

    {membership?.role === "STAFF" && <MenuSection title={t("profile.workSection")}>
      <MenuItem icon="airplane-outline" title={t("staffLeave.profileTitle")} description={t("staffLeave.profileDescription")} onPress={() => router.push("/staff-leave-requests" as never)} />
      <MenuItem icon="alarm-outline" title={t("profile.reminders")} description={t("reminders.subtitle")} onPress={() => router.push("/staff-reminders" as never)} />
    </MenuSection>}
    {(parentMemberships.length > 0 || profile?.registrationRole === "PARENT") && <MenuSection title={t("profile.familySection")}>
      {parentMemberships.length > 0 && <MenuItem icon="business-outline" title={t("profile.manageTenants")} description={t("profile.activeTenantsSummary", { count: parentMemberships.length })} onPress={() => setTenantSheetOpen(true)} />}
      {profile?.registrationRole === "PARENT" && <MenuItem icon="people-outline" title={t("parentFamily.cardTitle")} description={t("parentFamily.cardDescription")} onPress={() => router.push("/parent-family-profile" as never)} />}
    </MenuSection>}
    {membership?.active && <MenuSection title={t("operations.announcements")}>
      <MenuItem icon="megaphone-outline" title={t(membership.role === "STAFF_ADMIN" ? "operations.manageAnnouncements" : "operations.announcements")} description={t("operations.announcementsDescription")} onPress={() => router.push("/tenant-announcements" as never)} />
    </MenuSection>}

    <MenuSection title={t("profile.accountSection")}>
      <MenuItem icon="person-outline" title={t("profile.savePersonal")} onPress={() => setProfileSheet("profile")} />
      {usesPassword && <MenuItem icon="lock-closed-outline" title={t("profile.changePassword")} onPress={() => setProfileSheet("password")} />}
      {profile?.isPlatformAdmin && <MenuItem icon="keypad-outline" title={t("profile.changePin")} onPress={() => router.push("/admin-pin")} />}
    </MenuSection>
    <Card><LanguageSelectField /></Card>
    <View style={styles.appVersion}>
      <AppText variant="caption" tone="muted">{t("profile.appVersionSummary", {
        version: installedAppVersionInfo.version ?? t("common.noData"),
        buildCode: installedAppVersionInfo.buildCode ?? t("common.noData"),
      })}</AppText>
      <AppText variant="caption" tone="muted">{t("profile.copyright", { year: copyrightYear })}</AppText>
    </View>

    <Button variant="secondary" onPress={() => setLogoutSheetVisible(true)}><AppText variant="label" tone="danger">{t("auth.signOut")}</AppText></Button>
    <BottomSheet
      visible={tenantSheetOpen}
      onClose={() => setTenantSheetOpen(false)}
      closeAccessibilityLabel={t("common.close")}
      title={t("profile.manageTenants")}
    >
      <AppText tone="muted">{t("profile.manageTenantsDescription")}</AppText>
      {parentMemberships.map((item) => <MenuItem key={item.organizationId} icon="business-outline" title={item.organizationName} badge={item.organizationId === organizationId ? <Badge tone="success" icon="checkmark-circle" label={t("parentEnrollment.currentTenant")} /> : undefined} onPress={() => { setTenantSheetOpen(false); selectOrganization(item.organizationId); router.replace("/home"); }} />)}
      <Button variant="secondary" onPress={() => { setTenantSheetOpen(false); router.push("/parent-enrollment" as never); }}>{t("parentEnrollment.newTenant")}</Button>
    </BottomSheet>
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
      positiveAction={{ label: t("common.save"), loading: savingProfile, disabled: !displayName.trim() || !gender || !isIsoDate(dateOfBirth), onPress: () => void saveProfile() }}
    >
      <TextField label={t("profile.name")} required autoCapitalize="words" value={displayName} onChangeText={(value) => setDisplayName(capitalizeWords(value))} />
      <TextField label={t("profile.usernameOptional")} leadingIcon="at-outline" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
      <GenderPicker value={gender} onChange={setGender} />
      <View style={styles.field}><AppText variant="label">{t("profile.dateOfBirth")}</AppText><DatePicker placeholder={t("profile.dateOfBirth")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} /></View>
    </BottomSheet>
    <BottomSheet
      visible={profileSheet === "password"}
      onClose={() => setProfileSheet(null)}
      closeAccessibilityLabel={t("common.close")}
      title={t("profile.changePassword")}
      negativeAction={{ label: t("common.cancel"), onPress: () => setProfileSheet(null) }}
      positiveAction={{ label: t("common.save"), loading: savingPassword, disabled: !newPassword || !passwordConfirmation, onPress: () => void savePassword() }}
    >
      <AppText variant="label">{t("password.new")}</AppText>
      <PasswordInput value={newPassword} onChangeText={setNewPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
      <AppText variant="label">{t("password.confirm")}</AppText>
      <PasswordInput value={passwordConfirmation} onChangeText={setPasswordConfirmation} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  field: { gap: spacing.xs },
  appVersion: { alignItems: "center", paddingVertical: spacing.xs },
});
