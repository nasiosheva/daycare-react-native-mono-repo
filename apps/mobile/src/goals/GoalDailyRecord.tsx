import { StyleSheet, View } from "react-native";
import type { ChildGoal } from "@daycare/api-client";
import type { GoalCheckInOutcome } from "@daycare/core";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { buildGoalDailyRecordData } from "./goalDailyRecordData";

type GoalDailyRecordProps = {
  goal: Pick<ChildGoal, "indicators" | "checkIns">;
};

export function GoalDailyRecord({ goal }: GoalDailyRecordProps) {
  const { t, formatDate } = useI18n();
  const activeIndicators = goal.indicators.filter((indicator) => indicator.active);
  const data = buildGoalDailyRecordData(goal);

  return <View style={styles.container}>
    <AppText variant="label">{t("goals.dailyRecord")}</AppText>
    {data.days.length === 0
      ? <><AppText tone="muted" variant="caption">{t("goals.dailyRecordEmpty")}</AppText><View style={styles.day} accessible accessibilityLabel={t("goals.dailyRecordSummary", { recorded: 0, total: data.activeIndicatorCount, yes: 0, no: 0 })}>
        <AppText tone="muted" variant="caption">{t("goals.dailyRecordSummary", { recorded: 0, total: data.activeIndicatorCount, yes: 0, no: 0 })}</AppText>
        {activeIndicators.map((indicator) => <DailyIndicatorResult key={indicator.id} name={indicator.name} outcome={null} />)}
      </View></>
      : data.days.map((day) => <View key={day.date} style={styles.day} accessible accessibilityLabel={t("goals.dailyRecordSummary", { recorded: day.recordedIndicatorCount, total: data.activeIndicatorCount, yes: day.yesCount, no: day.noCount })}>
        <View style={styles.dayHeader}>
          <AppText variant="label">{formatDate(day.date)}</AppText>
          <AppText tone="muted" variant="caption">{t("goals.dailyRecordSummary", { recorded: day.recordedIndicatorCount, total: data.activeIndicatorCount, yes: day.yesCount, no: day.noCount })}</AppText>
        </View>
        {activeIndicators.map((indicator) => {
          const outcome = day.outcomes[indicator.id];
          return <DailyIndicatorResult key={indicator.id} name={indicator.name} outcome={outcome} />;
        })}
      </View>)}
  </View>;
}

function DailyIndicatorResult({ name, outcome }: { name: string; outcome: GoalCheckInOutcome | null }) {
  const { t } = useI18n();
  const label = outcome === "YES" ? t("goals.yes") : outcome === "NO" ? t("goals.no") : t("goals.notRecorded");
  return <View style={styles.result} accessible accessibilityLabel={`${name}: ${label}`}>
    <View style={[styles.marker, outcome === "YES" ? styles.markerYes : outcome === "NO" ? styles.markerNo : styles.markerMissing]} />
    <AppText style={styles.resultName} variant="caption">{name}</AppText>
    <AppText variant="caption" tone={outcome === "NO" ? "danger" : outcome == null ? "muted" : "default"}>{label}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
  day: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dayHeader: { gap: spacing.xs },
  result: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resultName: { flex: 1 },
  marker: { width: 10, height: 10, borderRadius: radius.pill },
  markerYes: { backgroundColor: colors.accent },
  markerNo: { backgroundColor: colors.danger },
  markerMissing: { backgroundColor: colors.border },
});
