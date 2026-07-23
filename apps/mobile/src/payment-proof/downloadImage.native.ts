import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function downloadPaymentProofImage(fileName: string, contentType: string, dataBase64: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, dataBase64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: contentType });
}
