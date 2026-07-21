import type { PropsWithChildren, ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "./theme";

export function Screen({ children, header }: PropsWithChildren<{ header?: ReactNode }>) {
  return <SafeAreaView style={styles.safe}><View style={styles.header}>{header}</View><ScrollView contentContainerStyle={styles.content}>{children}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md, width: "100%", maxWidth: 1080, alignSelf: "center" },
});
