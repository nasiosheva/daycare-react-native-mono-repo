// Mories Deo Hutapea,S.E.,S.Kom

import { useI18n } from "@/i18n/I18nProvider";
import { Banner } from "@daycare/ui";
import { useOffline } from "./OfflineProvider";

export function OfflineStatusBanner() {
  const { status, pendingCount, lastSyncAt } = useOffline();
  const { t } = useI18n();
  if (status === "ONLINE" && pendingCount === 0) return null;
  const message = status === "OFFLINE"
    ? t("offline.offlineDescription", { count: pendingCount })
    : status === "API_UNAVAILABLE"
      ? `${t("offline.apiUnavailableDescription")}${pendingCount > 0 ? ` · ${t("offline.pendingDrafts", { count: pendingCount })}` : ""}`
    : status === "SYNCING"
      ? t("offline.syncing")
      : status === "CONFLICT"
        ? t("offline.conflict")
        : status === "STALE"
          ? t("offline.stale")
          : t("offline.online", { count: pendingCount });
  const titleKey = status === "API_UNAVAILABLE" ? "offline.apiUnavailableTitle" : `offline.${status.toLowerCase()}Title`;
  return <Banner tone={status === "CONFLICT" || status === "STALE" ? "danger" : status === "OFFLINE" || status === "API_UNAVAILABLE" ? "warning" : "info"} title={t(titleKey as never)} message={`${message}${lastSyncAt ? ` · ${t("offline.lastSync", { date: lastSyncAt })}` : ""}`} />;
}

