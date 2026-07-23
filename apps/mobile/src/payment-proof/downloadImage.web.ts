export async function downloadPaymentProofImage(fileName: string, contentType: string, dataBase64: string): Promise<void> {
  const link = document.createElement("a");
  link.href = `data:${contentType};base64,${dataBase64}`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
