// Mories Deo Hutapea,S.E.,S.Kom
import { isValidHttpsImageUrl } from "../media/imageUrl";

const EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/webp": "webp",
};

const SUPPORTED_IMAGE_EXTENSIONS = new Set(Object.values(EXTENSION_BY_MIME_TYPE));

export function announcementImageDownloadInfo(url: string, title: string, announcementId: string, mimeType?: string | null): { fileName: string; mimeType: string } {
  if (!isValidHttpsImageUrl(url)) throw new Error("operations.imageDownloadInvalidUrl");

  const normalizedMimeType = mimeType?.split(";")[0]?.trim().toLowerCase();
  if (normalizedMimeType && !normalizedMimeType.startsWith("image/")) throw new Error("operations.imageDownloadInvalidFormat");

  const mimeExtension = normalizedMimeType ? EXTENSION_BY_MIME_TYPE[normalizedMimeType] : undefined;
  if (normalizedMimeType && !mimeExtension) throw new Error("operations.imageDownloadInvalidFormat");
  const urlExtension = extensionFromUrl(url);
  const extension = mimeExtension ?? urlExtension;
  if (!extension) throw new Error("operations.imageDownloadInvalidFormat");

  const resolvedMimeType = normalizedMimeType && mimeExtension
    ? normalizedMimeType
    : Object.entries(EXTENSION_BY_MIME_TYPE).find(([, candidate]) => candidate === extension)?.[0];
  if (!resolvedMimeType) throw new Error("operations.imageDownloadInvalidFormat");

  const baseName = safeFilePart(title) || "announcement";
  const id = safeFilePart(announcementId).slice(0, 12) || "image";
  return { fileName: `${baseName}-${id}.${extension}`, mimeType: resolvedMimeType };
}

function extensionFromUrl(url: string): string | undefined {
  const path = new URL(url).pathname;
  const extension = path.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  return extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension) ? extension : undefined;
}

function safeFilePart(value: string): string {
  return value.normalize("NFKD").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").replace(/-+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "");
}
