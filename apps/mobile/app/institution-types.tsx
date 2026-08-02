import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InstitutionTypeDefinition, InstitutionTypeDefinitionInput, InstitutionTypeParameters } from "@daycare/api-client";
import { AppText, BackButton, Button, ShimmerList, ToggleSwitch, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";

type Sheet = "create" | "edit" | "delete" | null;
type ParameterRow = { key: string; value: string };

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
  const createInstitutionType = useMutation({ mutationFn: (input: InstitutionTypeDefinitionInput) => api.createInstitutionType(input), onSuccess: refresh });
  const updateInstitutionType = useMutation({ mutationFn: ({ code, ...input }: InstitutionTypeDefinitionInput & { code: string }) => api.updateInstitutionType(code, input), onSuccess: refresh });
  const deleteInstitutionType = useMutation({ mutationFn: (code: string) => api.deleteInstitutionType(code), onSuccess: refresh });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedType, setSelectedType] = useState<InstitutionTypeDefinition | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentOccupationVisible, setParentOccupationVisible] = useState(false);
  const [parentIncomeRangeVisible, setParentIncomeRangeVisible] = useState(false);
  const [logo, setLogo] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("");
  const [borderColor, setBorderColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [parameters, setParameters] = useState<ParameterRow[]>([]);
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const closeSheet = () => {
    setSheet(null);
    setSelectedType(null);
    setName("");
    setDescription("");
    setParentOccupationVisible(false);
    setParentIncomeRangeVisible(false);
    setLogo("");
    setBackgroundColor("");
    setBorderColor("");
    setTextColor("");
    setParameters([]);
  };
  const openCreate = () => {
    setName("");
    setDescription("");
    setSelectedType(null);
    setParentOccupationVisible(false);
    setParentIncomeRangeVisible(false);
    setLogo("");
    setBackgroundColor("");
    setBorderColor("");
    setTextColor("");
    setParameters([]);
    setSheet("create");
  };
  const openEdit = (type: InstitutionTypeDefinition) => {
    setSelectedType(type);
    setName(type.name);
    setDescription(type.description ?? "");
    setParentOccupationVisible(type.parentOccupationVisible);
    setParentIncomeRangeVisible(type.parentIncomeRangeVisible);
    setLogo(type.logo ?? "");
    setBackgroundColor(type.backgroundColor ?? "");
    setBorderColor(type.borderColor ?? "");
    setTextColor(type.textColor ?? "");
    setParameters(Object.entries(type.parameters).map(([key, value]) => ({ key, value })));
    setSheet("edit");
  };
  const openDelete = (type: InstitutionTypeDefinition) => {
    setSelectedType(type);
    setSheet("delete");
  };
  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return Alert.alert(t("institutionCatalog.nameRequired"));
    const parameterValues = parameterValuesFromRows(parameters);
    if (!parameterValues) return Alert.alert(t("institutionCatalog.parameterKeyRequired"));
    try {
      if (sheet === "create") {
        await createInstitutionType.mutateAsync({ name: trimmedName, description: description.trim(), parentOccupationVisible, parentIncomeRangeVisible, logo: logo.trim(), backgroundColor: backgroundColor.trim(), borderColor: borderColor.trim(), textColor: textColor.trim(), parameters: parameterValues });
        Alert.alert(t("institutionCatalog.created"));
      } else if (sheet === "edit" && selectedType) {
        await updateInstitutionType.mutateAsync({ code: selectedType.code, name: trimmedName, description: description.trim(), parentOccupationVisible, parentIncomeRangeVisible, logo: logo.trim(), backgroundColor: backgroundColor.trim(), borderColor: borderColor.trim(), textColor: textColor.trim(), parameters: parameterValues });
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
        <InstitutionTypeFormFields autoFocus name={name} onNameChange={setName} description={description} onDescriptionChange={setDescription} logo={logo} onLogoChange={setLogo} backgroundColor={backgroundColor} onBackgroundColorChange={setBackgroundColor} borderColor={borderColor} onBorderColorChange={setBorderColor} textColor={textColor} onTextColorChange={setTextColor} parameters={parameters} onParametersChange={setParameters} occupationVisible={parentOccupationVisible} incomeRangeVisible={parentIncomeRangeVisible} onOccupationVisibleChange={setParentOccupationVisible} onIncomeRangeVisibleChange={setParentIncomeRangeVisible} />
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
        <InstitutionTypeFormFields autoFocus name={name} onNameChange={setName} description={description} onDescriptionChange={setDescription} logo={logo} onLogoChange={setLogo} backgroundColor={backgroundColor} onBackgroundColorChange={setBackgroundColor} borderColor={borderColor} onBorderColorChange={setBorderColor} textColor={textColor} onTextColorChange={setTextColor} parameters={parameters} onParametersChange={setParameters} occupationVisible={parentOccupationVisible} incomeRangeVisible={parentIncomeRangeVisible} onOccupationVisibleChange={setParentOccupationVisible} onIncomeRangeVisibleChange={setParentIncomeRangeVisible} />
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
        <View style={styles.content}><AppText variant="heading">{type.name}</AppText><AppText variant="caption" tone="muted">{type.code}</AppText>{type.description && <AppText tone="muted">{type.description}</AppText>}<AppText variant="caption" tone="muted">{parentInformationSummary(type, t)}</AppText></View>
        <View style={styles.actions}>
          <Button variant="secondary" onPress={() => openEdit(type)}>{t("common.edit")}</Button>
          <Button variant="danger" onPress={() => openDelete(type)}>{t("institutionCatalog.delete")}</Button>
        </View>
      </View>;
    })}
  </AppScreen>;
}

function InstitutionTypeFormFields({ autoFocus, name, onNameChange, description, onDescriptionChange, logo, onLogoChange, backgroundColor, onBackgroundColorChange, borderColor, onBorderColorChange, textColor, onTextColorChange, parameters, onParametersChange, occupationVisible, incomeRangeVisible, onOccupationVisibleChange, onIncomeRangeVisibleChange }: { autoFocus: boolean; name: string; onNameChange: (value: string) => void; description: string; onDescriptionChange: (value: string) => void; logo: string; onLogoChange: (value: string) => void; backgroundColor: string; onBackgroundColorChange: (value: string) => void; borderColor: string; onBorderColorChange: (value: string) => void; textColor: string; onTextColorChange: (value: string) => void; parameters: ParameterRow[]; onParametersChange: (value: ParameterRow[]) => void; occupationVisible: boolean; incomeRangeVisible: boolean; onOccupationVisibleChange: (value: boolean) => void; onIncomeRangeVisibleChange: (value: boolean) => void }) {
  const { t } = useI18n();
  return <>
    <TextInput autoFocus={autoFocus} style={styles.input} placeholder={t("institutionCatalog.name")} value={name} onChangeText={onNameChange} />
    <TextInput multiline maxLength={2000} style={[styles.input, styles.descriptionInput]} placeholder={t("institutionCatalog.typeDescription")} value={description} onChangeText={onDescriptionChange} />
    <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} placeholder={t("institutionCatalog.logo")} value={logo} onChangeText={onLogoChange} />
    <TextInput autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder={t("institutionCatalog.backgroundColor")} value={backgroundColor} onChangeText={onBackgroundColorChange} />
    <TextInput autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder={t("institutionCatalog.borderColor")} value={borderColor} onChangeText={onBorderColorChange} />
    <TextInput autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder={t("institutionCatalog.textColor")} value={textColor} onChangeText={onTextColorChange} />
    <AppText variant="label">{t("institutionCatalog.parameters")}</AppText>
    {parameters.map((parameter, index) => <View key={`parameter-${index}`} style={styles.parameterRow}>
      <TextInput autoCapitalize="none" autoCorrect={false} style={[styles.input, styles.parameterInput]} placeholder={t("institutionCatalog.parameterKey")} value={parameter.key} onChangeText={(key) => onParametersChange(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, key } : item))} />
      <TextInput style={[styles.input, styles.parameterInput]} placeholder={t("institutionCatalog.parameterValue")} value={parameter.value} onChangeText={(value) => onParametersChange(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item))} />
      <Button variant="danger" onPress={() => onParametersChange(parameters.filter((_, itemIndex) => itemIndex !== index))}>{t("institutionCatalog.removeParameter")}</Button>
    </View>)}
    <Button variant="secondary" onPress={() => onParametersChange([...parameters, { key: "", value: "" }])}>{t("institutionCatalog.addParameter")}</Button>
    <ParentInformationVisibilitySettings occupationVisible={occupationVisible} incomeRangeVisible={incomeRangeVisible} onOccupationVisibleChange={onOccupationVisibleChange} onIncomeRangeVisibleChange={onIncomeRangeVisibleChange} />
  </>;
}

function parameterValuesFromRows(rows: ParameterRow[]): InstitutionTypeParameters | null {
  const parameters: InstitutionTypeParameters = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key && !row.value.trim()) continue;
    if (!key || Object.hasOwn(parameters, key)) return null;
    parameters[key] = row.value.trim();
  }
  return parameters;
}

function ParentInformationVisibilitySettings({ occupationVisible, incomeRangeVisible, onOccupationVisibleChange, onIncomeRangeVisibleChange }: { occupationVisible: boolean; incomeRangeVisible: boolean; onOccupationVisibleChange: (value: boolean) => void; onIncomeRangeVisibleChange: (value: boolean) => void }) {
  const { t } = useI18n();
  return <View style={styles.visibilitySettings}>
    <AppText variant="label">{t("institutionCatalog.parentInformation")}</AppText>
    <ToggleSwitch label={t("institutionCatalog.parentOccupationVisible")} description={t("institutionCatalog.parentOccupationVisibleDescription")} value={occupationVisible} onValueChange={onOccupationVisibleChange} accessibilityLabel={t("institutionCatalog.parentOccupationVisible")} />
    <ToggleSwitch label={t("institutionCatalog.parentIncomeRangeVisible")} description={t("institutionCatalog.parentIncomeRangeVisibleDescription")} value={incomeRangeVisible} onValueChange={onIncomeRangeVisibleChange} accessibilityLabel={t("institutionCatalog.parentIncomeRangeVisible")} />
  </View>;
}

function parentInformationSummary(type: InstitutionTypeDefinition, t: (key: TranslationKey) => string) {
  const visible = [type.parentOccupationVisible ? t("institutionCatalog.parentOccupationVisible") : null, type.parentIncomeRangeVisible ? t("institutionCatalog.parentIncomeRangeVisible") : null].filter((value): value is string => value !== null);
  return visible.length ? `${t("institutionCatalog.parentInformation")}: ${visible.join(" · ")}` : t("institutionCatalog.parentInformationHidden");
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  content: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  visibilitySettings: { gap: spacing.sm },
  parameterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  parameterInput: { flexGrow: 1, minWidth: 140 },
  descriptionInput: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: "top" },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
