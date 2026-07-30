export function capitalizeWords(value: string): string {
  return value.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}
