// Mories Deo Hutapea,S.E.,S.Kom
import type { TenantPaymentProofContent } from "@daycare/api-client";

export async function openTenantPaymentProof(content: TenantPaymentProofContent): Promise<void> {
  const raw = globalThis.atob(content.fileBase64);
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: content.contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = content.fileName.replace(/[\\/]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
