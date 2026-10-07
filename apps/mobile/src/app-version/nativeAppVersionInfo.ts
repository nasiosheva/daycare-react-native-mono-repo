import * as Application from "expo-application";
import Constants from "expo-constants";
import { resolveAppVersionInfo } from "./versionInfo";

/** The version metadata of the binary currently running on this device. */
export const installedAppVersionInfo = resolveAppVersionInfo({
  nativeApplicationVersion: Application.nativeApplicationVersion,
  nativeBuildVersion: Application.nativeBuildVersion,
  configuredVersion: Constants.expoConfig?.version,
});
