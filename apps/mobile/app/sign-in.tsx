import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, colors, PasswordInput, radius, Screen, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { clearRememberedCredentials, loadRememberedCredentials, saveRememberedCredentials } from "@/auth/rememberedCredentialsStorage";
import { simulationRoleOptions } from "@/auth/simulation";
import { env } from "@/config/env";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { localAuthIdentifierLabel, roleKey } from "@/i18n/translations";

export default function SignInScreen() {
  const { signInWithEmail, signInWithGoogle, signInAsSimulationRole } = useAuth();
  const { locale, t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void loadRememberedCredentials().then((credentials) => {
      if (!active || !credentials) return;
      setIdentifier(credentials.identifier);
      setPassword(credentials.password);
      setRememberMe(true);
    });
    return () => { active = false; };
  }, []);

  const updateRememberMe = async (nextValue: boolean) => {
    setRememberMe(nextValue);
    if (!nextValue) await clearRememberedCredentials();
  };

  const submitEmail = async () => {
    const normalizedIdentifier = identifier.trim();
    try {
      setLoading(true);
      await signInWithEmail(normalizedIdentifier, password);
      if (rememberMe) await saveRememberedCredentials({ identifier: normalizedIdentifier, password });
      else await clearRememberedCredentials();
      router.replace("/");
    }
    catch (error) { Alert.alert(t("auth.signInFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setLoading(false); }
  };
  const submitGoogle = async () => {
    try { setLoading(true); await signInWithGoogle(); router.replace("/"); }
    catch (error) { Alert.alert(t("auth.googleFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setLoading(false); }
  };
  const submitSimulationRole = (role: (typeof simulationRoleOptions)[number]["role"]) => {
    signInAsSimulationRole(role);
    router.replace("/");
  };

  return <Screen><View style={styles.container}>
    <View style={styles.topBar}>
      <LanguageSwitcher compact />
    </View>
    <AppText variant="title">Umur Emas</AppText>
    {env.isSimulation && <View style={styles.simulationSection}>
      <AppText variant="label">{t("auth.simulation")}</AppText>
      <AppText variant="caption" tone="muted">{t("auth.simulationDescription")}</AppText>
      {simulationRoleOptions.map(({ role }) => <Button key={role} variant="secondary" onPress={() => submitSimulationRole(role)}>{t("auth.simulationPrefix", { role: t(roleKey(role)) })}</Button>)}
      <AppText variant="caption" tone="muted">{t("auth.simulationWarning")}</AppText>
    </View>}
    {env.isSimulation && <AppText variant="caption" tone="muted">{t("auth.orFirebase")}</AppText>}
    <AppText variant="label">{env.isLocalAuth ? localAuthIdentifierLabel(locale) : t("auth.email")}</AppText>
    <TextInput style={styles.input} autoCapitalize="none" keyboardType={env.isLocalAuth ? "default" : "email-address"} value={identifier} onChangeText={setIdentifier} />
    <AppText variant="label">{t("auth.password")}</AppText>
    <PasswordInput value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }} onPress={() => void updateRememberMe(!rememberMe)} style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed]}>
      <View style={[styles.rememberIndicator, rememberMe && styles.rememberIndicatorActive]}>
        {rememberMe && <AppText variant="caption" style={styles.rememberIndicatorLabel}>✓</AppText>}
      </View>
      <AppText>{t("auth.rememberMe")}</AppText>
    </Pressable>
    <Button loading={loading} onPress={submitEmail}>{t("auth.signIn")}</Button>
    {!env.isLocalAuth && <>
      <Button variant="secondary" loading={loading} onPress={submitGoogle}>{t("auth.google")}</Button>
      <Button variant="secondary" onPress={() => router.push("/verify-phone")}>{t("auth.phone")}</Button>
    </>}
  </View></Screen>;
}
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.sm, paddingTop: 40 },
  topBar: { alignItems: "flex-end", marginBottom: spacing.sm },
  simulationSection: { gap: spacing.sm, paddingVertical: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rememberIndicator: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  rememberIndicatorActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rememberIndicatorLabel: { color: colors.onPrimary, fontWeight: "700" },
  pressed: { opacity: 0.82 },
});
