import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BackButton, Button, Screen, spacing, TextField } from "@daycare/ui";
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
    try {
      setLoading(true);
      const { needsRegistration } = await verifyPhoneCode(code);
      router.replace(needsRegistration ? "/sign-up" : "/");
    }
    catch (error) { Alert.alert(t("auth.invalidCode"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setLoading(false); }
  };
  return <Screen title={t("auth.verifyCode")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.container}>
    <AppText tone="muted">{t(codeSent ? "auth.otpDescription" : "auth.phoneDescription")}</AppText>
    <TextField
      label={t("auth.phone")}
      hint={codeSent ? undefined : t("auth.phoneFormatHint")}
      leadingIcon="call-outline"
      placeholder="+628..."
      keyboardType="phone-pad"
      autoCapitalize="none"
      autoComplete="tel"
      value={phoneNumber}
      onChangeText={setPhoneNumber}
      editable={!codeSent}
    />
    {!codeSent && <Button loading={sending} disabled={!phoneNumber.trim()} onPress={() => void sendCode()}>{t("auth.sendCode")}</Button>}
    {codeSent && <>
      <TextField label={t("auth.otpCode")} leadingIcon="keypad-outline" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
      <Button loading={loading} disabled={!code.trim()} onPress={() => void submit()}>{t("auth.verifyCode")}</Button>
      <Button variant="secondary" loading={sending} onPress={() => void sendCode()}>{t("auth.resendCode")}</Button>
    </>}
  </View></Screen>;
}
const styles = StyleSheet.create({ container: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.md, paddingTop: 72 } });
