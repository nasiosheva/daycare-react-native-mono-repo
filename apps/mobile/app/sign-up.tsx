import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Button, colors, PasswordInput, radius, Screen, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export default function SignUpScreen() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth(); const { t } = useI18n();
  const [displayName, setDisplayName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async () => { try { setLoading(true); await signUpWithEmail(email.trim(), password, displayName.trim()); router.replace("/"); } catch (error) { Alert.alert(t("auth.signUpFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } finally { setLoading(false); } };
  return <Screen><View style={styles.content}>
    <AppText variant="title">Umur Emas</AppText><AppText tone="muted">{t("auth.signUpSubtitle")}</AppText>
    <AppText variant="label">{t("profile.name")}</AppText><TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />
    <AppText variant="label">{t("auth.email")}</AppText><TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    <AppText variant="label">{t("auth.password")}</AppText><PasswordInput value={password} onChangeText={setPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    <Button loading={loading} onPress={() => void submit()}>{t("auth.createParentAccount")}</Button><Button variant="secondary" disabled={loading} onPress={() => router.back()}>{t("auth.signIn")}</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({ content: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.sm, paddingTop: 40 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface } });
