import { router } from "expo-router";
import { AppText, Button, Screen } from "@daycare/ui";
import { useChildren } from "@/attendance/useAttendance";

export default function ChildrenScreen() {
  const children = useChildren();
  return <Screen header={<Button variant="ghost" onPress={() => router.back()}>Kembali</Button>}>
    <AppText variant="title">Anak</AppText>
    {children.data?.map((child) => <AppText key={child.id}>{child.fullName}</AppText>)}
    {!children.isLoading && children.data?.length === 0 && <AppText tone="muted">Belum ada anak terdaftar.</AppText>}
  </Screen>;
}
