import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InstitutionTypeDefinition } from "@daycare/api-client";
import { AppText, BackButton, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";

type Sheet = "create" | "edit" | "delete" | null;

export default function InstitutionTypesScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const institutionTypes = useQuery({ queryKey: ["platform-institution-types"], queryFn: () => api.institutionTypes(), enabled: Boolean(profile?.isPlatformAdmin) });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["platform-institution-types"] }),
    queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }),
    queryClient.invalidateQueries({ queryKey: ["platform-tenant"] }),
  ]);
  const createInstitutionType = useMutation({ mutationFn: (name: string) => api.createInstitutionType({ name }), onSuccess: refresh });
  const updateInstitutionType = useMutation({ mutationFn: ({ code, name }: { code: string; name: string }) => api.updateInstitutionType(code, { name }), onSuccess: refresh });
  const deleteInstitutionType = useMutation({ mutationFn: (code: string) => api.deleteInstitutionType(code), onSuccess: refresh });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedType, setSelectedType] = useState<InstitutionTypeDefinition | null>(null);
  const [name, setName] = useState("");
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const closeSheet = () => {
    setSheet(null);
    setSelectedType(null);
    setName("");
  };
  const openCreate = () => {
    setName("");
    setSelectedType(null);
    setSheet("create");
  };
  const openEdit = (type: InstitutionTypeDefinition) => {
    setSelectedType(type);
    setName(type.name);
    setSheet("edit");
  };
  const openDelete = (type: InstitutionTypeDefinition) => {
    setSelectedType(type);
    setSheet("delete");
  };
  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return Alert.alert(t("institutionCatalog.nameRequired"));
    try {
      if (sheet === "create") {
        await createInstitutionType.mutateAsync(trimmedName);
        Alert.alert(t("institutionCatalog.created"));
      } else if (sheet === "edit" && selectedType) {
        await updateInstitutionType.mutateAsync({ code: selectedType.code, name: trimmedName });
        Alert.alert(t("institutionCatalog.updated"));
      }
      closeSheet();
    } catch (error) {
      Alert.alert(t(sheet === "create" ? "institutionCatalog.createFailed" : "institutionCatalog.updateFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };
  const remove = async () => {
    if (!selectedType) return;
    try {
      await deleteInstitutionType.mutateAsync(selectedType.code);
      closeSheet();
      Alert.alert(t("institutionCatalog.deleted"));
    } catch (error) {
      Alert.alert(t("institutionCatalog.deleteFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  return <AppScreen showBottomNavigation={false} title={t("institutionCatalog.manage")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("institutionCatalog.description")}</AppText>

    {sheet === "create"
      ? <View style={styles.form}>
        <AppText variant="heading">{t("institutionCatalog.add")}</AppText>
        <TextInput autoFocus style={styles.input} placeholder={t("institutionCatalog.name")} value={name} onChangeText={setName} />
        <View style={styles.actions}>
          <Button variant="secondary" onPress={closeSheet}>{t("common.cancel")}</Button>
          <Button loading={createInstitutionType.isPending} onPress={() => void save()}>{t("common.save")}</Button>
        </View>
      </View>
      : <Button onPress={openCreate}>{t("institutionCatalog.add")}</Button>}

    {institutionTypes.isFetching && <ShimmerList />}
    {institutionTypes.isError && <Button variant="secondary" onPress={() => institutionTypes.refetch()}>{t("institutionCatalog.reload")}</Button>}
    {!institutionTypes.isFetching && !institutionTypes.isError && institutionTypes.data?.length === 0 && <AppText tone="muted">{t("institutionCatalog.empty")}</AppText>}
    {!institutionTypes.isFetching && institutionTypes.data?.map((type) => {
      const isSelected = selectedType?.code === type.code;
      if (isSelected && sheet === "edit") return <View key={type.code} style={styles.form}>
        <AppText variant="heading">{t("institutionCatalog.edit")}</AppText>
        <TextInput autoFocus style={styles.input} placeholder={t("institutionCatalog.name")} value={name} onChangeText={setName} />
        <View style={styles.actions}>
          <Button variant="secondary" onPress={closeSheet}>{t("common.cancel")}</Button>
          <Button loading={updateInstitutionType.isPending} onPress={() => void save()}>{t("common.save")}</Button>
        </View>
      </View>;
      if (isSelected && sheet === "delete") return <View key={type.code} style={styles.form}>
        <AppText variant="heading">{type.name}</AppText>
        <AppText tone="muted">{t("institutionCatalog.deleteConfirmation", { name: type.name })}</AppText>
        <View style={styles.actions}>
          <Button variant="secondary" onPress={closeSheet}>{t("common.cancel")}</Button>
          <Button variant="danger" loading={deleteInstitutionType.isPending} onPress={() => void remove()}>{t("institutionCatalog.delete")}</Button>
        </View>
      </View>;
      return <View key={type.code} style={styles.card}>
        <View style={styles.content}><AppText variant="heading">{type.name}</AppText><AppText variant="caption" tone="muted">{type.code}</AppText></View>
        <View style={styles.actions}>
          <Button variant="secondary" onPress={() => openEdit(type)}>{t("common.edit")}</Button>
          <Button variant="danger" onPress={() => openDelete(type)}>{t("institutionCatalog.delete")}</Button>
        </View>
      </View>;
    })}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  content: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
