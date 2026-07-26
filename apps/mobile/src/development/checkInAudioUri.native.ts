import * as FileSystem from "expo-file-system";

export async function checkInAudioPlaybackUri(dataBase64: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}check-in-audio-${Date.now()}.m4a`;
  await FileSystem.writeAsStringAsync(uri, dataBase64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}
