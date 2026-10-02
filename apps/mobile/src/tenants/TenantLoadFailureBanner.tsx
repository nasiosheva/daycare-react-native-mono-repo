import { Banner, Button } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { TenantRef } from "./acrossTenants";

// Shown above a cross-tenant aggregate whose other tenants still loaded; a failed request is never
// rendered as "no data" (docs/business-rules.md §13.2).
export function TenantLoadFailureBanner({ failedTenants, onRetry }: { failedTenants: readonly TenantRef[]; onRetry: () => void }) {
  const { t } = useI18n();
  if (failedTenants.length === 0) return null;
  return <Banner tone="warning" title={t("common.tenantLoadFailed", { tenants: failedTenants.map((tenant) => tenant.organizationName).join(", ") })} action={<Button variant="secondary" onPress={onRetry}>{t("common.retry")}</Button>} />;
}
