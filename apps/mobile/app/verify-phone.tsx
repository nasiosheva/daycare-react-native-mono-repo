import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, Screen, spacing } from "@daycare/ui";
import { strings } from "@/i18n/strings";
import { useAuth } from "@/auth/AuthProvider";

export default function VerifyPhoneScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { verifyPhoneCode } = useAuth();
  const submit = async () => {
    try { setLoading(true); await verifyPhoneCode(code); router.replace("/"); }
    catch (error) { Alert.alert("Kode tidak valid", error instanceof Error ? error.message : "Silakan coba lagi."); }
    finally { setLoading(false); }
  };
  return <Screen><View style={styles.container}>
    <AppText variant="title">{strings.verifyCode}</AppText>
    <AppText tone="muted">Masukkan kode SMS yang dikirimkan. Kode aktif disimpan aman selama sesi ini.</AppText>
    <TextInput style={styles.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
    <Button loading={loading} onPress={submit}>{strings.verifyCode}</Button>
    <Button variant="ghost" onPress={() => router.back()}>Kembali</Button>
  </View></Screen>;
}
const styles = StyleSheet.create({ container: { width: "100%", maxWidth: 420, alignSelf: "center", gap: spacing.md, paddingTop: 72 }, input: { minHeight: 48, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#FFF" } });
