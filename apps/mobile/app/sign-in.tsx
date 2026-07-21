import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, Screen, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { strings } from "@/i18n/strings";

export default function SignInScreen() {
  const { signInWithEmail, signInWithGoogle, sendPhoneCode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const submitEmail = async () => {
    try { setLoading(true); await signInWithEmail(email.trim(), password); router.replace("/"); }
    catch (error) { Alert.alert("Tidak dapat masuk", error instanceof Error ? error.message : "Silakan coba lagi."); }
    finally { setLoading(false); }
  };
  const submitPhone = async () => {
    try { await sendPhoneCode(phoneNumber); router.push("/verify-phone"); }
    catch (error) { Alert.alert("OTP belum tersedia", error instanceof Error ? error.message : "Silakan gunakan email."); }
  };
  const submitGoogle = async () => {
    try { setLoading(true); await signInWithGoogle(); router.replace("/"); }
    catch (error) { Alert.alert("Tidak dapat masuk dengan Google", error instanceof Error ? error.message : "Silakan coba lagi."); }
    finally { setLoading(false); }
  };

  return <Screen><View style={styles.container}>
    <AppText variant="title">{strings.appName}</AppText>
    <AppText tone="muted">Masuk untuk mengelola kegiatan daycare.</AppText>
    <AppText variant="label">{strings.email}</AppText>
    <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    <AppText variant="label">{strings.password}</AppText>
    <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
    <Button loading={loading} onPress={submitEmail}>{strings.signIn}</Button>
    <Button variant="secondary" loading={loading} onPress={submitGoogle}>Lanjutkan dengan Google</Button>
    <AppText variant="caption" tone="muted">atau gunakan nomor telepon</AppText>
    <TextInput style={styles.input} placeholder="+628..." keyboardType="phone-pad" value={phoneNumber} onChangeText={setPhoneNumber} />
    <Button variant="secondary" onPress={submitPhone}>{strings.sendCode}</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({ container: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.sm, paddingTop: 72 }, input: { minHeight: 48, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#FFF" } });
