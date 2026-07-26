import * as FileSystem from "expo-file-system";

export async function encodeLocalFileBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
