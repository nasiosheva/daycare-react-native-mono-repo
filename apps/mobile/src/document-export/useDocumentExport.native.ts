import { useCallback, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { saveDownloadedReport, shareDocumentExport } from "./downloader";
import type { DocumentExportController, DocumentExportDefinition, DocumentExportError, DocumentExportFile } from "./types";

export function useDocumentExport<Row>(definition: DocumentExportDefinition<Row>): DocumentExportController {
  const { api } = useAuth();
  const [file, setFile] = useState<DocumentExportFile | null>(null);
  const [error, setError] = useState<DocumentExportError | null>(null);
  const [isGenerating, setGenerating] = useState(false);

  const create = useCallback(async (format: "pdf" | "xlsx"): Promise<DocumentExportFile | null> => {
    setGenerating(true);
    setError(null);
    try {
      const downloaded = definition.report === "CHILDREN" ? await api.downloadChildrenReport(format === "pdf" ? "PDF" : "XLSX") : null;
      if (!downloaded) throw new Error("export.unsupported");
      const generated = await saveDownloadedReport(downloaded);
      setFile(generated);
      return generated;
    } catch {
      setError({ code: "export_failed" });
      return null;
    } finally {
      setGenerating(false);
    }
  }, [definition]);

  const share = useCallback(async (): Promise<boolean> => {
    if (!file) return false;
    try {
      const shared = await shareDocumentExport(file);
      if (!shared) setError({ code: "sharing_unavailable" });
      return shared;
    } catch {
      setError({ code: "export_failed" });
      return false;
    }
  }, [file]);

  const clear = useCallback(() => { setFile(null); setError(null); }, []);

  return { status: isGenerating ? "generating" : error ? "error" : file ? "ready" : "idle", file, error, exportPdf: () => create("pdf"), exportExcel: () => create("xlsx"), share, clear };
}
