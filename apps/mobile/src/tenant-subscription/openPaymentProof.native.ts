// Mories Deo Hutapea,S.E.,S.Kom
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { TenantPaymentProofContent } from "@daycare/api-client";

export async function openTenantPaymentProof(content: TenantPaymentProofContent): Promise<void> {
  if (!FileSystem.cacheDirectory) throw new Error("tenantSubscription.proofCacheUnavailable");
  const safeName = content.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uri = `${FileSystem.cacheDirectory}tenant-payment-proof-${content.id}-${safeName}`;
  await FileSystem.writeAsStringAsync(uri, content.fileBase64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) throw new Error("tenantSubscription.proofOpenUnavailable");
  await Sharing.shareAsync(uri, { mimeType: content.contentType, dialogTitle: content.fileName });
}
