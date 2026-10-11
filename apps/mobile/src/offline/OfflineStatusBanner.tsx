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
    : status === "SYNCING"
      ? t("offline.syncing")
      : status === "CONFLICT"
        ? t("offline.conflict")
        : status === "STALE"
          ? t("offline.stale")
          : t("offline.online", { count: pendingCount });
  return <Banner tone={status === "CONFLICT" || status === "STALE" ? "danger" : status === "OFFLINE" ? "warning" : "info"} title={t(`offline.${status.toLowerCase()}Title` as never)} message={`${message}${lastSyncAt ? ` · ${t("offline.lastSync", { date: lastSyncAt })}` : ""}`} />;
}

