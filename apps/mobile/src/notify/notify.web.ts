import { publishInlineFeedback } from "@daycare/ui";

export function notify(title: string, message?: string): void {
  publishInlineFeedback(title, message);
}
