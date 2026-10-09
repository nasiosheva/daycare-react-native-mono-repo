import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";

export default function Index() {
  const { registrationRequired, user, loading } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator /></View>;
  if (registrationRequired) return <Redirect href="/sign-up" />;
  if (user) return <Redirect href="/home" />;
  // No pushed screen should survive behind sign-in (e.g. after a session is lost).
  return <Redirect href="/sign-in" dismissStack />;
}

const styles = StyleSheet.create({ loading: { flex: 1, justifyContent: "center" } });
