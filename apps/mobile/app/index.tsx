import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";

export default function Index() {
  const { registrationRequired, user, loading } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator /></View>;
  return <Redirect href={registrationRequired ? "/sign-up" : user ? "/home" : "/sign-in"} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, justifyContent: "center" } });
