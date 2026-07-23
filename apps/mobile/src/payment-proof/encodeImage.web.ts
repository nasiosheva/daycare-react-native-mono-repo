import type { PickedImage } from "@/image-picker";

export async function encodePaymentProofImage(image: PickedImage): Promise<string> {
  const blob = await fetch(image.uri).then((response) => response.blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read payment proof image"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(blob);
  });
}
