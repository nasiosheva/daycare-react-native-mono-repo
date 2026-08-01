import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Button, colors, PasswordInput, radius, Screen, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { authErrorMessage } from "@/auth/authErrorMessage";
import { clearRememberedCredentials, loadRememberedCredentials, saveRememberedCredentials } from "@/auth/rememberedCredentialsStorage";
import { useI18n } from "@/i18n/I18nProvider";

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(null);
      setLoading(true);
      await signInWithEmail(normalizedIdentifier, password);
      if (rememberMe) await saveRememberedCredentials({ identifier: normalizedIdentifier, password });
      else await clearRememberedCredentials();
      router.replace("/");
    }
    catch (error) { setErrorMessage(authErrorMessage(error, t)); }
    finally { setLoading(false); }
  };
  return <Screen><View style={styles.container}>
    <Image source={require("../assets/images/login-icon.png")} style={styles.logo} resizeMode="contain" />
    <AppText variant="title">Umur Emas</AppText>
    <AppText variant="label">{t("auth.identifier")}</AppText>
    <TextInput style={styles.input} autoCapitalize="none" keyboardType="default" value={identifier} onChangeText={(value) => { setIdentifier(value); setErrorMessage(null); }} />
    <AppText variant="label">{t("auth.password")}</AppText>
    <PasswordInput value={password} onChangeText={(value) => { setPassword(value); setErrorMessage(null); }} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    {errorMessage && <View style={styles.errorMessage}><AppText tone="danger">{errorMessage}</AppText></View>}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }} onPress={() => void updateRememberMe(!rememberMe)} style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed]}>
      <View style={[styles.rememberIndicator, rememberMe && styles.rememberIndicatorActive]}>
        {rememberMe && <AppText variant="caption" style={styles.rememberIndicatorLabel}>✓</AppText>}
      </View>
      <AppText>{t("auth.rememberMe")}</AppText>
    </Pressable>
    <Button loading={loading} onPress={submitEmail}>{t("auth.signIn")}</Button>
    <Button variant="secondary" disabled={loading} onPress={() => router.push("/sign-up" as never)}>{t("auth.createParentAccount")}</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 420, alignSelf: "center", flex: 1, justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  logo: { width: 96, height: 96, alignSelf: "center", marginBottom: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface },
  errorMessage: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rememberIndicator: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  rememberIndicatorActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rememberIndicatorLabel: { color: colors.onPrimary, fontWeight: "700" },
  pressed: { opacity: 0.82 },
});
