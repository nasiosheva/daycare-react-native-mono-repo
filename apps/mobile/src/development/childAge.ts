import { dateFromIsoDate } from "../date-picker/date";

export function ageInMonths(dateOfBirth: string, today: Date = new Date()): number {
  const birth = dateFromIsoDate(dateOfBirth);
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}
