export const IMAGE_PICKER_MAX_SELECTION = 10;
export const IMAGE_PICKER_QUALITY = 0.8;

export type PickedImageSource = "library" | "camera" | "recovered";

export type PickedImage = {
  uri: string;
  source: PickedImageSource;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  width: number;
  height: number;
  selectedAt: string;
};

export type ImagePickerStatus = "idle" | "requesting_camera_permission" | "picking" | "completed" | "error" | "unsupported";

export type ImagePickerErrorCode = "camera_permission_denied" | "picker_failed" | "recovery_failed" | "unsupported";

export type ImagePickerError = {
  code: ImagePickerErrorCode;
  message: string;
};

export type ImagePickerController = {
  status: ImagePickerStatus;
  images: PickedImage[];
  error: ImagePickerError | null;
  pickFromLibrary: () => Promise<PickedImage[]>;
  takePhoto: () => Promise<PickedImage | null>;
  recoverPendingResult: () => Promise<PickedImage[]>;
  clear: () => void;
};

export type ImagePickerAssetInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
  width: number;
  height: number;
};

export function createPickedImage(asset: ImagePickerAssetInput, source: PickedImageSource, selectedAt: Date): PickedImage {
  return {
    uri: asset.uri,
    source,
    width: asset.width,
    height: asset.height,
    selectedAt: selectedAt.toISOString(),
    ...(asset.fileName ? { fileName: asset.fileName } : {}),
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    ...(asset.fileSize === undefined ? {} : { fileSizeBytes: asset.fileSize }),
  };
}

export function createPickedImages(
  assets: ImagePickerAssetInput[] | null,
  source: PickedImageSource,
  selectedAt: Date,
  limit = IMAGE_PICKER_MAX_SELECTION,
): PickedImage[] {
  if (!assets) return [];
  return assets.slice(0, limit).map((asset) => createPickedImage(asset, source, selectedAt));
}
