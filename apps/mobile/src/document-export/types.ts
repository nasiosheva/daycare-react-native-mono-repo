export const DOCUMENT_EXPORT_FORMATS = ["pdf", "xlsx"] as const;
export const DOCUMENT_EXPORT_REPORTS = ["CHILDREN"] as const;

export type DocumentExportFormat = (typeof DOCUMENT_EXPORT_FORMATS)[number];
export type DocumentExportReport = (typeof DOCUMENT_EXPORT_REPORTS)[number];
export type DocumentExportCellValue = string | number | boolean | Date | null | undefined;

export type DocumentExportColumn<Row> = {
  key: string;
  label: string;
  value: (row: Row) => DocumentExportCellValue;
};

export type DocumentExportDefinition<Row> = {
  report: DocumentExportReport;
  title: string;
  fileName: string;
  sheetName?: string;
  subtitle?: string;
  generatedAt?: { label: string; value: string };
  emptyValue: string;
  columns: readonly DocumentExportColumn<Row>[];
  rows: readonly Row[];
};

export type DocumentExportFile = {
  format: DocumentExportFormat;
  fileName: string;
  mimeType: string;
  createdAt: string;
  uri?: string;
};

export type DocumentExportStatus = "idle" | "generating" | "ready" | "error";
export type DocumentExportErrorCode = "export_failed" | "sharing_unavailable" | "unsupported";
export type DocumentExportError = { code: DocumentExportErrorCode };

export type DocumentExportController = {
  status: DocumentExportStatus;
  file: DocumentExportFile | null;
  error: DocumentExportError | null;
  exportPdf: () => Promise<DocumentExportFile | null>;
  exportExcel: () => Promise<DocumentExportFile | null>;
  share: () => Promise<boolean>;
  clear: () => void;
};

export function formatDocumentExportCell(value: DocumentExportCellValue, emptyValue: string): string {
  if (value === null || value === undefined || value === "") return emptyValue;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function documentExportRow<Row>(definition: DocumentExportDefinition<Row>, row: Row): string[] {
  return definition.columns.map((column) => formatDocumentExportCell(column.value(row), definition.emptyValue));
}
