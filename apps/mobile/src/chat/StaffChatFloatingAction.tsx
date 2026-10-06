import { useRouter } from "expo-router";
import { FloatingActionButton } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";

export function StaffChatFloatingAction() {
  const router = useRouter();
  const { t } = useI18n();
  return <FloatingActionButton
    icon="chatbubbles-outline"
    accessibilityLabel={t("childMessage.staffEntry")}
    onPress={() => router.push({ pathname: "/children", params: { mode: "messages" } } as never)}
  >{t("childMessage.staffEntry")}</FloatingActionButton>;
}
