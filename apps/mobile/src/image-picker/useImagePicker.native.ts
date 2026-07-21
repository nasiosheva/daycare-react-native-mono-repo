import { useCallback, useEffect, useState } from "react";
import * as ExpoImagePicker from "expo-image-picker";
import {
  type ImagePickerController,
  type ImagePickerError,
  type ImagePickerErrorCode,
  type PickedImage,
  type PickedImageSource,
  IMAGE_PICKER_MAX_SELECTION,
  IMAGE_PICKER_QUALITY,
  createPickedImages,
} from "./types";

const libraryOptions: ExpoImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  allowsMultipleSelection: true,
  base64: false,
  exif: false,
  mediaTypes: ["images"],
  quality: IMAGE_PICKER_QUALITY,
  selectionLimit: IMAGE_PICKER_MAX_SELECTION,
};

const cameraOptions: ExpoImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  base64: false,
  exif: false,
  mediaTypes: ["images"],
  quality: IMAGE_PICKER_QUALITY,
};

function toError(code: ImagePickerErrorCode, error?: unknown): ImagePickerError {
  return { code, message: error instanceof Error ? error.message : "Image picking is unavailable." };
}

function toPickedImages(result: ExpoImagePicker.ImagePickerResult, source: PickedImageSource): PickedImage[] {
  if (result.canceled || !result.assets) return [];
  const limit = source === "camera" ? 1 : IMAGE_PICKER_MAX_SELECTION;
  return createPickedImages(result.assets, source, new Date(), limit);
}

function isErrorResult(result: ExpoImagePicker.ImagePickerResult | ExpoImagePicker.ImagePickerErrorResult): result is ExpoImagePicker.ImagePickerErrorResult {
  return "code" in result;
}

export function useImagePicker(): ImagePickerController {
  const [status, setStatus] = useState<ImagePickerController["status"]>("idle");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<ImagePickerError | null>(null);

  const applyResult = useCallback((result: ExpoImagePicker.ImagePickerResult, source: PickedImageSource): PickedImage[] => {
    const nextImages = toPickedImages(result, source);
    if (result.canceled) {
      setStatus("idle");
      return [];
    }

    setImages(nextImages);
    setError(null);
    setStatus("completed");
    return nextImages;
  }, []);

  const pickFromLibrary = useCallback(async (): Promise<PickedImage[]> => {
    setStatus("picking");
    setError(null);

    try {
      return applyResult(await ExpoImagePicker.launchImageLibraryAsync(libraryOptions), "library");
    } catch (nextError) {
      setError(toError("picker_failed", nextError));
      setStatus("error");
      return [];
    }
  }, [applyResult]);

  const takePhoto = useCallback(async (): Promise<PickedImage | null> => {
    setStatus("requesting_camera_permission");
    setError(null);

    try {
      const permission = await ExpoImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError(toError("camera_permission_denied", new Error("Camera permission was denied.")));
        setStatus("error");
        return null;
      }

      setStatus("picking");
      return applyResult(await ExpoImagePicker.launchCameraAsync(cameraOptions), "camera")[0] ?? null;
    } catch (nextError) {
      setError(toError("picker_failed", nextError));
      setStatus("error");
      return null;
    }
  }, [applyResult]);

  const recoverPendingResult = useCallback(async (): Promise<PickedImage[]> => {
    try {
      const result = await ExpoImagePicker.getPendingResultAsync();
      if (!result) return [];
      if (isErrorResult(result)) {
        setError(toError("recovery_failed", new Error(result.message)));
        setStatus("error");
        return [];
      }

      return applyResult(result, "recovered");
    } catch (nextError) {
      setError(toError("recovery_failed", nextError));
      setStatus("error");
      return [];
    }
  }, [applyResult]);

  useEffect(() => {
    void recoverPendingResult();
  }, [recoverPendingResult]);

  const clear = useCallback(() => {
    setImages([]);
    setError(null);
    setStatus("idle");
  }, []);

  return { status, images, error, pickFromLibrary, takePhoto, recoverPendingResult, clear };
}
