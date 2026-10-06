import { useRouter } from "expo-router";
import { useI18n } from "@/i18n/I18nProvider";
import { ChatFloatingAction } from "./ChatFloatingAction";
import { useChildMessageUnreadSummary } from "./useChildMessageUnreadSummary";

export function StaffChatFloatingAction() {
  const router = useRouter();
  const { t } = useI18n();
  const { totalUnreadCount } = useChildMessageUnreadSummary();
  return <ChatFloatingAction
    label={t("childMessage.staffEntry")}
    unreadCount={totalUnreadCount}
    onPress={() => router.push({ pathname: "/children", params: { mode: "messages" } } as never)}
  />;
}
