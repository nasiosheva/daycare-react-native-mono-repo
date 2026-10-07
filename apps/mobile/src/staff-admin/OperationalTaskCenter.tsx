import { Ionicons } from "@expo/vector-icons";
import { AppText, Badge, Banner, Button, MenuItem, MenuSection, ShimmerList } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import type { OperationalTask, OperationalTaskKind } from "./operationalTasks";

type OperationalTaskCenterProps = {
  tasks: readonly OperationalTask[];
  isLoading: boolean;
  hasError: boolean;
  onOpen: (kind: OperationalTaskKind) => void;
  onRetry: () => void;
};

type TaskPresentation = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
};

const taskPresentation: Record<OperationalTaskKind, TaskPresentation> = {
  PAYMENT_PROOF_REVIEW: { icon: "receipt-outline", titleKey: "staffAdmin.task.paymentProof.title", descriptionKey: "staffAdmin.task.paymentProof.description" },
  BOOKING_APPROVAL: { icon: "checkmark-done-outline", titleKey: "staffAdmin.task.booking.title", descriptionKey: "staffAdmin.task.booking.description" },
  ENROLLMENT_APPROVAL: { icon: "person-add-outline", titleKey: "staffAdmin.task.enrollment.title", descriptionKey: "staffAdmin.task.enrollment.description" },
  STAFF_LEAVE_APPROVAL: { icon: "airplane-outline", titleKey: "staffAdmin.task.staffLeave.title", descriptionKey: "staffAdmin.task.staffLeave.description" },
  TENANT_FEEDBACK_REVIEW: { icon: "chatbox-ellipses-outline", titleKey: "staffAdmin.task.feedback.title", descriptionKey: "staffAdmin.task.feedback.description" },
  PRIVATE_TUTORING_APPROVAL: { icon: "school-outline", titleKey: "staffAdmin.task.privateTutoring.title", descriptionKey: "staffAdmin.task.privateTutoring.description" },
};

/** Read-only task index. Opening an item enters the existing guarded screen. */
export function OperationalTaskCenter({ tasks, isLoading, hasError, onOpen, onRetry }: OperationalTaskCenterProps) {
  const { t } = useI18n();

  return <MenuSection title={t("staffAdmin.operationalTasks")}>
    <AppText tone="muted">{t("staffAdmin.operationalTasksDescription")}</AppText>
    {hasError && <Banner tone="warning" title={t("staffAdmin.operationalTasksLoadFailed")} message={t("staffAdmin.operationalTasksLoadFailedDescription")} action={<Button variant="secondary" onPress={onRetry}>{t("common.retry")}</Button>} />}
    {isLoading && tasks.length === 0 && <ShimmerList count={2} />}
    {tasks.map((task) => {
      const presentation = taskPresentation[task.kind];
      return <MenuItem
        key={task.kind}
        attention
        icon={presentation.icon}
        title={t(presentation.titleKey)}
        description={t(presentation.descriptionKey)}
        badge={<Badge tone="danger" label={t("staffAdmin.operationalTaskCount", { count: task.count })} />}
        onPress={() => onOpen(task.kind)}
      />;
    })}
    {!isLoading && !hasError && tasks.length === 0 && <AppText tone="muted">{t("staffAdmin.noOperationalTasks")}</AppText>}
  </MenuSection>;
}
