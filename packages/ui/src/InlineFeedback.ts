export type InlineFeedback = {
  title: string;
  message?: string;
};

type InlineFeedbackListener = (feedback: InlineFeedback) => void;

const listeners = new Set<InlineFeedbackListener>();

export function publishInlineFeedback(title: string, message?: string): void {
  const feedback = { title, message };
  listeners.forEach((listener) => listener(feedback));
}

export function subscribeInlineFeedback(nextListener: InlineFeedbackListener): () => void {
  listeners.add(nextListener);
  return () => listeners.delete(nextListener);
}
