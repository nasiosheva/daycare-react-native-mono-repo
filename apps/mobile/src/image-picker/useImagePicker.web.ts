import { useCallback, useState } from "react";
import { createPickedImage, type ImagePickerController, type ImagePickerError, type PickedImage } from "./types";

function selectImage(capture = false): Promise<PickedImage[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png";
    if (capture) input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve([]);
      const uri = URL.createObjectURL(file);
      resolve([createPickedImage({ uri, fileName: file.name, mimeType: file.type, fileSize: file.size, width: 0, height: 0 }, capture ? "camera" : "library", new Date())]);
    };
    input.click();
  });
}

export function useImagePicker(): ImagePickerController {
  const [error, setError] = useState<ImagePickerError | null>(null);
  const pick = useCallback(async (capture: boolean) => {
    try {
      const images = await selectImage(capture);
      setError(null);
      return images;
    } catch (nextError) {
      setError({ code: "picker_failed", message: nextError instanceof Error ? nextError.message : "Image picking is unavailable." });
      return [];
    }
  }, []);
  const clear = useCallback(() => setError(null), []);

  return {
    status: error ? "error" : "idle",
    images: [],
    error,
    pickFromLibrary: () => pick(false),
    takePhoto: async () => (await pick(true))[0] ?? null,
    recoverPendingResult: async () => [],
    clear,
  };
}
