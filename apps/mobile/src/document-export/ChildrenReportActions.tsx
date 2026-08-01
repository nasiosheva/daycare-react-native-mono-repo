import type { ChildListFilter } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { DownloadReportActions } from "./DownloadReportActions";

export function ChildrenReportActions({ canExport, filter }: { canExport: boolean; filter: ChildListFilter }) {
  const { api } = useAuth();
  if (!canExport) return null;
  return <DownloadReportActions download={(format) => api.downloadChildrenReport(format, filter)} />;
}
