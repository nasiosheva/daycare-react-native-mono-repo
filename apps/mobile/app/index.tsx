import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  return <Redirect href={user ? "/home" : "/sign-in"} />;
}
