import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BackButton, Button, colors, radius, Screen, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const { sendPhoneCode, verifyPhoneCode } = useAuth();
  const { t } = useI18n();
  const sendCode = async () => {
    try {
      setSending(true);
      await sendPhoneCode(phoneNumber.trim());
      setCodeSent(true);
    } catch (error) {
      Alert.alert(t("auth.otpUnavailable"), error instanceof Error ? error.message : t("auth.useEmail"));
    } finally {
      setSending(false);
    }
  };
  const submit = async () => {
    try { setLoading(true); await verifyPhoneCode(code); router.replace("/"); }
    catch (error) { Alert.alert(t("auth.invalidCode"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setLoading(false); }
  };
  return <Screen title={t("auth.verifyCode")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.container}>
    <AppText tone="muted">{t(codeSent ? "auth.otpDescription" : "auth.phoneDescription")}</AppText>
    <TextInput
      style={styles.input}
      placeholder="+628..."
      keyboardType="phone-pad"
      autoCapitalize="none"
      value={phoneNumber}
      onChangeText={setPhoneNumber}
      editable={!codeSent}
    />
    {!codeSent && <Button loading={sending} disabled={!phoneNumber.trim()} onPress={() => void sendCode()}>{t("auth.sendCode")}</Button>}
    {codeSent && <>
      <TextInput style={styles.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder={t("auth.otpCode")} />
      <Button loading={loading} disabled={!code.trim()} onPress={() => void submit()}>{t("auth.verifyCode")}</Button>
      <Button variant="secondary" loading={sending} onPress={() => void sendCode()}>{t("auth.resendCode")}</Button>
    </>}
  </View></Screen>;
}
const styles = StyleSheet.create({ container: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.md, paddingTop: 72 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface } });
