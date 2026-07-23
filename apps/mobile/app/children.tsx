import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useChildren } from "@/attendance/useAttendance";
import { useCreateChild } from "@/children/useChildManagement";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";

export default function ChildrenScreen() {
  const router = useRouter();
  const children = useChildren();
  const { t } = useI18n();
  const { profile, organizationId } = useAuth();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const canOpenDetail = membership?.role === "STAFF_ADMIN" || membership?.role === "STAFF";
  const createChild = useCreateChild();
  const [addVisible, setAddVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nisn, setNisn] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const closeAddChild = () => {
    setAddVisible(false);
    setFirstName("");
    setLastName("");
    setNisn("");
    setDateOfBirth("");
  };
  const saveChild = async () => {
    if (!firstName.trim() || !isIsoDate(dateOfBirth)) return Alert.alert(t("children.required"));
    try {
      await createChild.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, nisn: nisn.trim() || undefined, dateOfBirth });
      closeAddChild();
      Alert.alert(t("children.created"));
    } catch (error) { Alert.alert(t("children.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen>
    <AppText variant="title">{t("children.title")}</AppText>
    {canManage && <Button onPress={() => setAddVisible(true)}>{t("children.add")}</Button>}
    {children.data?.map((child) => <View key={child.id} style={styles.card}><AppText variant="h5">{child.fullName}</AppText><AppText tone="muted">{child.dateOfBirth}</AppText>{canOpenDetail && <Button variant="secondary" onPress={() => router.push({ pathname: "/child-detail", params: { childId: child.id } })}>{t(canManage ? "children.edit" : "children.view")}</Button>}</View>)}
    {!children.isLoading && children.data?.length === 0 && <AppText tone="muted">{t("children.empty")}</AppText>}
    <BottomSheet
      visible={addVisible}
      onClose={closeAddChild}
      closeAccessibilityLabel={t("common.close")}
      title={t("children.add")}
      negativeAction={{ label: t("common.cancel"), onPress: closeAddChild }}
      positiveAction={{ label: t("children.save"), loading: createChild.isPending, disabled: !firstName.trim() || !dateOfBirth.trim(), onPress: () => void saveChild() }}
    >
      <TextInput style={styles.input} placeholder={t("children.firstName")} value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder={t("children.lastName")} value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("children.nisn")} value={nisn} onChangeText={setNisn} />
      <DatePicker placeholder={t("children.birthDate")} value={dateOfBirth} onChange={setDateOfBirth} maximumDate={formatIsoDate(new Date())} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface } });
