// Mories Deo Hutapea,S.E.,S.Kom
import { announcementImageDownloadInfo } from "./announcementImageDownload";
import { isValidHttpsImageUrl } from "../media/imageUrl";

export async function downloadAnnouncementImage(url: string, title: string, announcementId: string): Promise<void> {
  if (!isValidHttpsImageUrl(url)) throw new Error("operations.imageDownloadInvalidUrl");
  const response = await fetch(url);
  if (!response.ok) throw new Error("operations.imageDownloadFailed");

  const blob = await response.blob();
  const { fileName } = announcementImageDownloadInfo(url, title, announcementId, blob.type);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function shareAnnouncementImage(url: string, title: string, _announcementId: string): Promise<"shared" | "copied"> {
  if (!isValidHttpsImageUrl(url)) throw new Error("operations.imageDownloadInvalidUrl");
  if (navigator.share) {
    await navigator.share({ title, url });
    return "shared";
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return "copied";
  }
  throw new Error("operations.imageShareUnavailable");
}
