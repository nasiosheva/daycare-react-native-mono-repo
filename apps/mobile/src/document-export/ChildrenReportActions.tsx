import type { ChildListFilter } from "@daycare/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { DownloadReportActions } from "./DownloadReportActions";

export function ChildrenReportActions({ filter }: { filter: ChildListFilter }) {
  const { api } = useAuth();
  return <DownloadReportActions download={(format) => api.downloadChildrenReport(format, filter)} />;
}
