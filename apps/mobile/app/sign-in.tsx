import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, colors, PasswordInput, radius, Screen, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { simulationRoleOptions } from "@/auth/simulation";
import { env } from "@/config/env";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { roleKey } from "@/i18n/translations";

export default function SignInScreen() {
  const { signInWithEmail, signInWithGoogle, signInAsSimulationRole } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submitEmail = async () => {
    try { setLoading(true); await signInWithEmail(email.trim(), password); router.replace("/"); }
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
    <AppText tone="muted">{t("auth.signInSubtitle")}</AppText>
    {env.isSimulation && <View style={styles.simulationSection}>
      <AppText variant="label">{t("auth.simulation")}</AppText>
      <AppText variant="caption" tone="muted">{t("auth.simulationDescription")}</AppText>
      {simulationRoleOptions.map(({ role }) => <Button key={role} variant="secondary" onPress={() => submitSimulationRole(role)}>{t("auth.simulationPrefix", { role: t(roleKey(role)) })}</Button>)}
      <AppText variant="caption" tone="muted">{t("auth.simulationWarning")}</AppText>
    </View>}
    {env.isSimulation && <AppText variant="caption" tone="muted">{t("auth.orFirebase")}</AppText>}
    <AppText variant="label">{t("auth.email")}</AppText>
    <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    <AppText variant="label">{t("auth.password")}</AppText>
    <PasswordInput value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    <Button loading={loading} onPress={submitEmail}>{t("auth.signIn")}</Button>
    <Button variant="secondary" loading={loading} onPress={submitGoogle}>{t("auth.google")}</Button>
    <Button variant="secondary" onPress={() => router.push("/verify-phone")}>{t("auth.phone")}</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.sm, paddingTop: 40 },
  topBar: { alignItems: "flex-end", marginBottom: spacing.sm },
  simulationSection: { gap: spacing.sm, paddingVertical: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface },
});
