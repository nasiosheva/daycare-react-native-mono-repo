// Mories Deo Hutapea,S.E.,S.Kom
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { isValidHttpsImageUrl } from "../media/imageUrl";
import { announcementImageDownloadInfo } from "./announcementImageDownload";

type CachedAnnouncementImage = { uri: string; fileName: string; mimeType: string };

async function downloadToCache(url: string, title: string, announcementId: string): Promise<CachedAnnouncementImage> {
  if (!FileSystem.cacheDirectory) throw new Error("operations.imageDownloadUnavailable");
  if (!isValidHttpsImageUrl(url)) throw new Error("operations.imageDownloadInvalidUrl");

  const temporaryUri = `${FileSystem.cacheDirectory}announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.download`;
  let downloadedUri = temporaryUri;
  let finalUri: string | undefined;
  try {
    const response = await FileSystem.downloadAsync(url, temporaryUri);
    downloadedUri = response.uri;
    if (response.status < 200 || response.status >= 300) throw new Error("operations.imageDownloadFailed");

    const contentType = response.mimeType ?? response.headers["content-type"] ?? response.headers["Content-Type"];
    const image = announcementImageDownloadInfo(url, title, announcementId, contentType);
    const uri = `${FileSystem.cacheDirectory}${Date.now()}-${image.fileName}`;
    finalUri = uri;
    await FileSystem.moveAsync({ from: response.uri, to: uri });
    return { uri, fileName: image.fileName, mimeType: image.mimeType };
  } catch (error) {
    await Promise.all([temporaryUri, downloadedUri, finalUri].filter((uri, index, all): uri is string => Boolean(uri) && all.indexOf(uri) === index).map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)));
    throw error;
  }
}

async function cleanCachedImage(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export async function downloadAnnouncementImage(url: string, title: string, announcementId: string): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted) throw new Error("operations.imageDownloadPermissionDenied");

  const image = await downloadToCache(url, title, announcementId);
  try {
    await MediaLibrary.saveToLibraryAsync(image.uri);
  } finally {
    await cleanCachedImage(image.uri);
  }
}

export async function shareAnnouncementImage(url: string, title: string, announcementId: string): Promise<"shared" | "copied"> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("operations.imageShareUnavailable");
  const image = await downloadToCache(url, title, announcementId);
  try {
    await Sharing.shareAsync(image.uri, { mimeType: image.mimeType, dialogTitle: title || image.fileName });
    return "shared";
  } finally {
    await cleanCachedImage(image.uri);
  }
}
