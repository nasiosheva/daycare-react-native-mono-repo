import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { documentExportRow, type DocumentExportDefinition, type DocumentExportFile } from "./types";
import { useDocumentExport } from "./useDocumentExport";

type DocumentExportViewerProps<Row> = {
  document: DocumentExportDefinition<Row>;
  style?: StyleProp<ViewStyle>;
  onExported?: (file: DocumentExportFile) => void;
};

export function DocumentExportViewer<Row>({ document, style, onExported }: DocumentExportViewerProps<Row>) {
  const { t } = useI18n();
  const exportController = useDocumentExport(document);
  const isGenerating = exportController.status === "generating";

  const exportFile = async (format: "pdf" | "xlsx") => {
    const file = format === "pdf" ? await exportController.exportPdf() : await exportController.exportExcel();
    if (file) onExported?.(file);
  };

  return <View style={[styles.container, style]}>
    <View style={styles.heading}>
      <AppText variant="heading">{document.title}</AppText>
      {document.subtitle && <AppText tone="muted">{document.subtitle}</AppText>}
      {document.generatedAt && <AppText variant="caption" tone="muted">{document.generatedAt.label}: {document.generatedAt.value}</AppText>}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableContent}>
      <View>
        <View style={styles.headerRow}>
          {document.columns.map((column) => <View key={column.key} style={styles.headerCell}><AppText variant="label">{column.label}</AppText></View>)}
        </View>
        {document.rows.length === 0 && <View style={styles.empty}><AppText tone="muted">{document.emptyValue}</AppText></View>}
        {document.rows.map((row, index) => <View key={index} style={styles.row}>
          {documentExportRow(document, row).map((value, columnIndex) => <View key={document.columns[columnIndex].key} style={styles.cell}><AppText variant="bodySmall">{value}</AppText></View>)}
        </View>)}
      </View>
    </ScrollView>

    <View style={styles.actions}>
      <Button loading={isGenerating} disabled={isGenerating} onPress={() => void exportFile("pdf")}>{t("documentExport.pdf")}</Button>
      <Button variant="secondary" loading={isGenerating} disabled={isGenerating} onPress={() => void exportFile("xlsx")}>{t("documentExport.excel")}</Button>
      {exportController.file?.uri && <Button variant="secondary" onPress={() => void exportController.share()}>{t("documentExport.share")}</Button>}
    </View>
    {isGenerating && <AppText tone="muted">{t("documentExport.preparing")}</AppText>}
    {exportController.status === "ready" && <AppText tone="muted">{t("documentExport.ready", { fileName: exportController.file?.fileName ?? "" })}</AppText>}
    {exportController.error && <AppText tone="danger">{t(exportController.error.code === "sharing_unavailable" ? "documentExport.sharingUnavailable" : "documentExport.failed")}</AppText>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  heading: { gap: spacing.xs },
  tableContent: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
  headerRow: { flexDirection: "row", backgroundColor: colors.surfaceTint },
  headerCell: { minWidth: 148, padding: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  cell: { minWidth: 148, padding: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border },
  empty: { minWidth: 220, padding: spacing.md, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
