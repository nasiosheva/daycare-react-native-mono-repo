import { publishInlineFeedback, type InlineFeedbackTone } from "@daycare/ui";

export function notify(title: string, message?: string, tone?: InlineFeedbackTone): void {
  publishInlineFeedback(title, message, tone);
}
