export type AppVersionInfo = {
  version: string | null;
  buildCode: string | null;
};

type AppVersionInfoSource = {
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
  configuredVersion?: string | null;
};

function nonEmptyValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue || null;
}

/**
 * Uses the installed native binary where available. The configured version is
 * only a web fallback because browsers do not expose a native build code.
 */
export function resolveAppVersionInfo(source: AppVersionInfoSource): AppVersionInfo {
  return {
    version: nonEmptyValue(source.nativeApplicationVersion) ?? nonEmptyValue(source.configuredVersion),
    buildCode: nonEmptyValue(source.nativeBuildVersion),
  };
}
