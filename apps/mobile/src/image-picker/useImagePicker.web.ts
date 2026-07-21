import { useCallback, useState } from "react";
import type { ImagePickerController, ImagePickerError } from "./types";

const unsupportedError: ImagePickerError = {
  code: "unsupported",
  message: "Image picking is available on Android and iOS only.",
};

export function useImagePicker(): ImagePickerController {
  const [error, setError] = useState<ImagePickerError | null>(null);
  const unsupported = useCallback(async () => {
    setError(unsupportedError);
    return [];
  }, []);
  const clear = useCallback(() => setError(null), []);

  return {
    status: error ? "unsupported" : "idle",
    images: [],
    error,
    pickFromLibrary: unsupported,
    takePhoto: async () => {
      await unsupported();
      return null;
    },
    recoverPendingResult: async () => [],
    clear,
  };
}
