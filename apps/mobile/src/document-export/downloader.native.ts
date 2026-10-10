import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking } from "react-native";
import type { DownloadedReport } from "@daycare/api-client";
import type { DocumentExportFile } from "./types";

// Mories Deo Hutapea,S.E.,S.Kom

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

export async function previewDownloadedReport(file: DownloadedReport): Promise<boolean> {
  if (file.contentType !== "application/pdf") return false;
  const saved = await saveDownloadedReport(file);
  if (!saved.uri) return false;
  await Linking.openURL(saved.uri);
  return true;
}
