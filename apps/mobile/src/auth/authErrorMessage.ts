import { isApiNetworkError, isApiTimeoutError } from "@daycare/api-client";
import type { TranslationKey } from "../i18n/translations";

type Translate = (key: TranslationKey) => string;

export function authErrorMessage(error: unknown, t: Translate): string {
  if (isApiTimeoutError(error)) return t("auth.requestTimeout");
  if (isApiNetworkError(error)) return t("auth.serverUnavailable");
  return error instanceof Error && error.message ? error.message : t("auth.tryAgain");
}
