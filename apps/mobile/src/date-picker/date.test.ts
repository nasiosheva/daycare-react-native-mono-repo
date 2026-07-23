import { describe, expect, it } from "vitest";
import { dateFromIsoDate, dateFromIsoTime, formatIsoDate, formatIsoTime, isIsoDate, isIsoTime } from "./date";

describe("date picker date helpers", () => {
  it("keeps the selected local calendar date in ISO format", () => {
    expect(formatIsoDate(dateFromIsoDate("2026-07-22"))).toBe("2026-07-22");
  });

  it("accepts only the API date format", () => {
    expect(isIsoDate("2026-07-22")).toBe(true);
    expect(isIsoDate("22/07/2026")).toBe(false);
  });

  it("keeps a selected local time in 24-hour format", () => {
    expect(formatIsoTime(dateFromIsoTime("09:05"))).toBe("09:05");
    expect(isIsoTime("23:59")).toBe(true);
    expect(isIsoTime("24:00")).toBe(false);
  });
});
