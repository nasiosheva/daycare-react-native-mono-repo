import { useEffect, useState } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { appBrandName, AppText, Button, colors, PasswordInput, radius, Screen, spacing } from "@daycare/ui";
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
    <AppText variant="label">{t("profile.name")}</AppText><TextInput style={styles.input} autoCapitalize="words" value={displayName} onChangeText={(value) => setDisplayName(capitalizeWords(value))} />
    <AppText variant="label">{t("profile.usernameOptional")}</AppText><TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
    <AppText variant="label">{t("auth.email")}</AppText><TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!registrationRequired || !user?.email} />
    <AppText variant="label">{t("auth.password")}</AppText><PasswordInput value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    <Button loading={loading} onPress={() => void submit()}>{t("auth.createParentAccount")}</Button>
    <Button variant="secondary" leadingIcon={<FontAwesome name="google" size={18} color={colors.primary} />} loading={loading} onPress={() => void submitGoogle()}>{t("auth.google")}</Button>
    <Button variant="secondary" disabled={loading} onPress={() => router.push("/verify-phone" as never)}>{t("auth.phone")}</Button>
    <Button variant="secondary" disabled={loading} onPress={() => router.back()}>{t("auth.signIn")}</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({ content: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.sm, paddingTop: 40 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface } });
