export function notify(title: string, message?: string): void {
  globalThis.window?.alert(message ? `${title}\n\n${message}` : title);
}
