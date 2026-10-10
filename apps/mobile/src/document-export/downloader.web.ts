import type { DownloadedReport } from "@daycare/api-client";
import type { DocumentExportFile } from "./types";

// Mories Deo Hutapea,S.E.,S.Kom

export async function saveDownloadedReport(file: DownloadedReport): Promise<DocumentExportFile> {
  const bytes = Uint8Array.from(globalThis.atob(file.dataBase64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = file.fileName; anchor.click();
  URL.revokeObjectURL(url);
  return { fileName: file.fileName, mimeType: file.contentType, createdAt: new Date().toISOString(), format: file.contentType === "application/pdf" ? "pdf" : "xlsx" };
}

export async function shareDocumentExport(_file: DocumentExportFile): Promise<boolean> { return false; }

export async function previewDownloadedReport(file: DownloadedReport): Promise<boolean> {
  if (file.contentType !== "application/pdf") return false;
  const bytes = Uint8Array.from(globalThis.atob(file.dataBase64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
