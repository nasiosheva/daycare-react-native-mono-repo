import { useState } from "react";
import type { DownloadedReport } from "@daycare/api-client";
import { AppText, Button, spacing } from "@daycare/ui";
import { StyleSheet, View } from "react-native";
import { useI18n } from "@/i18n/I18nProvider";
import { saveDownloadedReport, shareDocumentExport } from "./downloader";
import type { DocumentExportFile } from "./types";

type ReportFormat = "PDF" | "XLSX";

export function DownloadReportActions({ download, disabled = false }: { download: (format: ReportFormat) => Promise<DownloadedReport>; disabled?: boolean }) {
  const { t } = useI18n();
  const [isExporting, setExporting] = useState(false);
  const [file, setFile] = useState<DocumentExportFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exportReport = async (format: ReportFormat) => {
    setError(null);
    try { setExporting(true); setFile(await saveDownloadedReport(await download(format))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("documentExport.failed")); }
    finally { setExporting(false); }
  };

  return <View style={styles.container}>
    {error && <AppText accessibilityRole="alert" tone="danger">{error}</AppText>}
    <View style={styles.actions}>
      <Button loading={isExporting} disabled={disabled || isExporting} onPress={() => void exportReport("PDF")}>{t("documentExport.pdf")}</Button>
      <Button variant="secondary" loading={isExporting} disabled={disabled || isExporting} onPress={() => void exportReport("XLSX")}>{t("documentExport.excel")}</Button>
      {file?.uri && <Button variant="secondary" onPress={() => void shareDocumentExport(file)}>{t("documentExport.share")}</Button>}
    </View>
    {file && <AppText variant="caption" tone="muted">{t("documentExport.ready", { fileName: file.fileName })}</AppText>}
  </View>;
}

const styles = StyleSheet.create({ container: { gap: spacing.sm }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
