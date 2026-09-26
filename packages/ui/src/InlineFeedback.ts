export type InlineFeedbackTone = "info" | "success" | "warning" | "danger";

export type InlineFeedback = {
  title: string;
  message?: string;
  tone?: InlineFeedbackTone;
};

type InlineFeedbackListener = (feedback: InlineFeedback) => void;

const listeners = new Set<InlineFeedbackListener>();

export function publishInlineFeedback(title: string, message?: string, tone?: InlineFeedbackTone): void {
  const feedback: InlineFeedback = tone ? { title, message, tone } : { title, message };
  listeners.forEach((listener) => listener(feedback));
}

export function subscribeInlineFeedback(nextListener: InlineFeedbackListener): () => void {
  listeners.add(nextListener);
  return () => listeners.delete(nextListener);
}

/** Errors stay on screen longer so there is time to read what went wrong. */
export function inlineFeedbackDuration(feedback: InlineFeedback): number {
  const base = feedback.tone === "danger" || feedback.tone === "warning" ? 9000 : 5000;
  return feedback.message ? base + 2000 : base;
}
