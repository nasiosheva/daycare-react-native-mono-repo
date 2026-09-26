import { useEffect, useState } from "react";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { appBrandName, AppText, Button, colors, PasswordInput, Screen, spacing, TextField } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { capitalizeWords } from "@/text/capitalizeWords";

export default function SignUpScreen() {
  const router = useRouter();
  const { registrationRequired, signInWithGoogle, signOut, signUpWithEmail, user } = useAuth(); const { t } = useI18n();
  const [displayName, setDisplayName] = useState(""); const [username, setUsername] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (registrationRequired && user?.email) setEmail(user.email); }, [registrationRequired, user?.email]);
  const submit = async () => {
    try {
      setLoading(true);
      const { usernameWarning } = await signUpWithEmail(email.trim(), password, displayName.trim(), username.trim() || undefined);
      if (usernameWarning) Alert.alert(t("auth.usernameSaveFailed"), usernameWarning);
      router.replace("/");
    } catch (error) { Alert.alert(t("auth.signUpFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setLoading(false); }
  };
  const submitGoogle = async () => { try { setLoading(true); const result = await signInWithGoogle(); if (result.needsRegistration) { if (result.email) setEmail(result.email); return; } await signOut(); Alert.alert(t("auth.googleFailed"), t("auth.useEmail")); router.replace("/sign-in"); } catch (error) { Alert.alert(t("auth.googleFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } finally { setLoading(false); } };
  return <Screen><View style={styles.content}>
    <AppText variant="title">{appBrandName}</AppText><AppText tone="muted">{t("auth.signUpSubtitle")}</AppText>
    <TextField label={t("profile.name")} required leadingIcon="person-outline" autoCapitalize="words" autoComplete="name" value={displayName} onChangeText={(value) => setDisplayName(capitalizeWords(value))} />
    <TextField label={t("profile.usernameOptional")} leadingIcon="at-outline" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
    <TextField label={t("auth.email")} required leadingIcon="mail-outline" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!registrationRequired || !user?.email} />
    <View style={styles.field}><View style={styles.labelRow}><AppText variant="label">{t("auth.password")}</AppText><AppText variant="label" tone="danger" accessibilityElementsHidden importantForAccessibility="no">*</AppText></View><PasswordInput value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} /></View>
    <Button loading={loading} style={styles.primaryAction} onPress={() => void submit()}>{t("auth.createParentAccount")}</Button>
    <View style={styles.divider}><View style={styles.dividerLine} /><AppText variant="caption" tone="muted">{t("auth.orContinueWith")}</AppText><View style={styles.dividerLine} /></View>
    <Button variant="secondary" leadingIcon={<FontAwesome name="google" size={18} color={colors.primary} />} loading={loading} onPress={() => void submitGoogle()}>{t("auth.google")}</Button>
    <Button variant="secondary" leadingIcon={<Ionicons name="call-outline" size={18} color={colors.primary} />} disabled={loading} onPress={() => router.push("/verify-phone" as never)}>{t("auth.phone")}</Button>
    <Button variant="ghost" disabled={loading} onPress={() => router.back()}>{t("auth.haveAccountSignIn")}</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.md, paddingTop: 40 },
  field: { gap: spacing.xs },
  labelRow: { flexDirection: "row", gap: 2 },
  primaryAction: { marginTop: spacing.sm },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
});
