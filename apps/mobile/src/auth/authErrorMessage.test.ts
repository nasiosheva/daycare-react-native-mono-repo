import { describe, expect, it } from "vitest";
import { ApiNetworkError, ApiTimeoutError } from "@daycare/api-client";
import { translate } from "../i18n/translations";
import { authErrorMessage } from "./authErrorMessage";

describe("authErrorMessage", () => {
  it("explains unreachable and slow API failures in the selected language", () => {
    const id = (key: Parameters<typeof translate>[1]) => translate("id", key);
    const en = (key: Parameters<typeof translate>[1]) => translate("en", key);

    expect(authErrorMessage(new ApiNetworkError(), id)).toContain("backend lokal");
    expect(authErrorMessage(new ApiTimeoutError(), en)).toContain("too long");
  });
});
