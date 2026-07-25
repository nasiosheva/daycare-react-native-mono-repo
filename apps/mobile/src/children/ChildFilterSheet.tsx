import { useEffect, useState } from "react";
import type { ChildListFilter } from "@daycare/api-client";
import { BottomSheet } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { ChildFilterTabs } from "@/children/ChildFilterTabs";

type ChildFilterSheetProps = {
  visible: boolean;
  filter: ChildListFilter;
  onClose: () => void;
  onApply: (filter: ChildListFilter) => void;
};

export function ChildFilterSheet({ visible, filter, onClose, onApply }: ChildFilterSheetProps) {
  const { t } = useI18n();
  const [draftFilter, setDraftFilter] = useState<ChildListFilter>({});

  useEffect(() => {
    if (!visible) return;
    setDraftFilter(filter);
  }, [filter, visible]);

  return <BottomSheet
    visible={visible}
    onClose={onClose}
    closeAccessibilityLabel={t("common.close")}
    title={t("children.filter")}
    negativeAction={{ label: t("children.clearFilters"), onPress: () => setDraftFilter({}) }}
    positiveAction={{ label: t("common.ok"), onPress: () => onApply(draftFilter) }}
  >
    <ChildFilterTabs filter={draftFilter} onChange={setDraftFilter} enabled={visible} />
  </BottomSheet>;
}
