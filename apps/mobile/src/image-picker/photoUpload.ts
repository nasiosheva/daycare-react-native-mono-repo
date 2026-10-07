import { encodeLocalFileBase64 } from "@/development/encodeLocalFile";
import type { PickedImage } from "./types";

export type PhotoUpload = { contentType: "image/jpeg" | "image/png"; dataBase64: string };

/** Converts a picked image into the JPEG/PNG base64 payload accepted by photo upload endpoints. */
export async function pickedImageUpload(image: PickedImage): Promise<PhotoUpload> {
  return { contentType: image.mimeType === "image/png" ? "image/png" : "image/jpeg", dataBase64: await encodeLocalFileBase64(image.uri) };
}
