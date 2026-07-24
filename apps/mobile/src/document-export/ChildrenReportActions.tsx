import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import type { ChildListFilter } from "@daycare/api-client";
import { AppText, Button, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { saveDownloadedReport, shareDocumentExport } from "./downloader";
import type { DocumentExportFile } from "./types";

export function ChildrenReportActions({ filter }: { filter: ChildListFilter }) {
  const { api } = useAuth();
  const { t } = useI18n();
  const [isExporting, setExporting] = useState(false);
  const [file, setFile] = useState<DocumentExportFile | null>(null);
  const exportReport = async (format: "PDF" | "XLSX") => {
    try {
      setExporting(true);
      setFile(await saveDownloadedReport(await api.downloadChildrenReport(format, filter)));
    } catch (error) { Alert.alert(t("documentExport.failed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
    finally { setExporting(false); }
  };

  return <View style={styles.container}>
    <Button loading={isExporting} disabled={isExporting} onPress={() => void exportReport("PDF")}>{t("documentExport.pdf")}</Button>
    <Button variant="secondary" loading={isExporting} disabled={isExporting} onPress={() => void exportReport("XLSX")}>{t("documentExport.excel")}</Button>
    {file?.uri && <Button variant="secondary" onPress={() => void shareDocumentExport(file)}>{t("documentExport.share")}</Button>}
    {file && <AppText variant="caption" tone="muted">{t("documentExport.ready", { fileName: file.fileName })}</AppText>}
  </View>;
}

const styles = StyleSheet.create({ container: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
