import * as FileSystem from "expo-file-system";
import type { PickedImage } from "@/image-picker";

export async function encodePaymentProofImage(image: PickedImage): Promise<string> {
  return FileSystem.readAsStringAsync(image.uri, { encoding: FileSystem.EncodingType.Base64 });
}
