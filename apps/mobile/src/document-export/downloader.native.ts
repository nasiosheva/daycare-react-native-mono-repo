import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { DownloadedReport } from "@daycare/api-client";
import type { DocumentExportFile } from "./types";

function cacheDirectory(): string {
  if (!FileSystem.cacheDirectory) throw new Error("export.cache_directory_unavailable");
  return FileSystem.cacheDirectory;
}

export async function saveDownloadedReport(file: DownloadedReport): Promise<DocumentExportFile> {
  const uri = `${cacheDirectory()}${file.fileName}`;
  await FileSystem.writeAsStringAsync(uri, file.dataBase64, { encoding: FileSystem.EncodingType.Base64 });
  return { fileName: file.fileName, mimeType: file.contentType, createdAt: new Date().toISOString(), format: file.contentType === "application/pdf" ? "pdf" : "xlsx", uri };
}

export async function shareDocumentExport(file: DocumentExportFile): Promise<boolean> {
  if (!file.uri || !(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: file.mimeType });
  return true;
}
