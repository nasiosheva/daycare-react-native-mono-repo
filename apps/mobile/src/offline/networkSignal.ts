// Mories Deo Hutapea,S.E.,S.Kom

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

export function subscribeNetworkSignal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markNetworkOffline(): void {
  listeners.forEach((listener) => listener(false));
}

export function markNetworkOnline(): void {
  listeners.forEach((listener) => listener(true));
}

