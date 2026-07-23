const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value);
}

export function isIsoTime(value: string): boolean {
  return ISO_TIME_PATTERN.test(value);
}

export function dateFromIsoDate(value: string): Date {
  if (!isIsoDate(value)) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromIsoTime(value: string): Date {
  const date = new Date();
  if (!isIsoTime(value)) return date;
  const [hours, minutes] = value.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatIsoTime(value: Date): string {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
