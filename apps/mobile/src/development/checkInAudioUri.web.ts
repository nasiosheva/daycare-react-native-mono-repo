export async function checkInAudioPlaybackUri(dataBase64: string): Promise<string> {
  return `data:audio/mp4;base64,${dataBase64}`;
}
