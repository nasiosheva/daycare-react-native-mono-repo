import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, Screen, spacing } from "@daycare/ui";
import { developmentCategories, type DevelopmentCategory, can } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useCreateDevelopmentEntry, useDevelopmentEntries } from "@/development/useDevelopment";
import { strings } from "@/i18n/strings";

const categoryLabels: Record<DevelopmentCategory, string> = {
  ACTIVITY: "Aktivitas",
  MEAL: "Makan",
  NAP: "Tidur",
  OBSERVATION: "Observasi",
};

export default function DevelopmentScreen() {
  const { profile, organizationId } = useAuth();
  const children = useChildren();
  const [childId, setChildId] = useState<string | null>(null);
  const [category, setCategory] = useState<DevelopmentCategory>("OBSERVATION");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const selectedChild = useMemo(() => children.data?.find((child) => child.id === childId) ?? null, [children.data, childId]);
  const entries = useDevelopmentEntries(childId);
  const createEntry = useCreateDevelopmentEntry(childId);
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canRecord = membership ? can(membership.role, "recordDevelopment") : false;

  useEffect(() => { if (!childId && children.data?.[0]) setChildId(children.data[0].id); }, [childId, children.data]);

  const submit = async () => {
    try {
      await createEntry.mutateAsync({ category, title, content });
      setTitle("");
      setContent("");
      Alert.alert("Tersimpan", "Catatan perkembangan sudah dibagikan kepada parent.");
    } catch (error) {
      Alert.alert("Tidak dapat menyimpan", error instanceof Error ? error.message : "Silakan coba lagi.");
    }
  };

  return <Screen header={<Button variant="ghost" onPress={() => router.back()}>Kembali</Button>}>
    <AppText variant="title">{strings.development}</AppText>
    <AppText tone="muted">Aktivitas harian, makan, tidur, dan observasi guru.</AppText>
    <View style={styles.selector}>
      {children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}
    </View>
    {selectedChild && canRecord && <View style={styles.form}>
      <AppText variant="heading">Catat perkembangan {selectedChild.fullName}</AppText>
      <View style={styles.selector}>{developmentCategories.map((item) => <Button key={item} variant={item === category ? "primary" : "secondary"} onPress={() => setCategory(item)}>{categoryLabels[item]}</Button>)}</View>
      <TextInput style={styles.input} placeholder="Judul singkat" value={title} onChangeText={setTitle} maxLength={120} />
      <TextInput style={[styles.input, styles.contentInput]} placeholder="Catatan perkembangan anak" value={content} onChangeText={setContent} multiline maxLength={2_000} textAlignVertical="top" />
      <Button loading={createEntry.isPending} disabled={!title.trim() || !content.trim()} onPress={() => void submit()}>Bagikan kepada parent</Button>
    </View>}
    <AppText variant="heading">Riwayat</AppText>
    {entries.isLoading && <AppText>Memuat perkembangan...</AppText>}
    {entries.isError && <Button onPress={() => entries.refetch()}>{strings.retry}</Button>}
    {entries.data?.map((entry) => <View key={entry.id} style={styles.entry}>
      <AppText variant="label">{categoryLabels[entry.category]} · {entry.title}</AppText>
      <AppText>{entry.content}</AppText>
      <AppText variant="caption" tone="muted">{new Date(entry.recordedAt).toLocaleString("id-ID")} · {entry.recordedBy}</AppText>
    </View>)}
    {selectedChild && !entries.isLoading && entries.data?.length === 0 && <AppText tone="muted">Belum ada catatan perkembangan.</AppText>}
  </Screen>;
}

const styles = StyleSheet.create({
  selector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: "#FFFFFF" },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#FFFFFF" },
  contentInput: { minHeight: 120, paddingTop: 12 },
  entry: { gap: spacing.xs, padding: spacing.md, borderRadius: 12, backgroundColor: "#FFFFFF" },
});
