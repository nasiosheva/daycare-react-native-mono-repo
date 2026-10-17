// Mories Deo Hutapea,S.E.,S.Kom

// API reachability is intentionally separate from the device's network connection state.
type Listener = (available: boolean) => void;
const listeners = new Set<Listener>();

export function subscribeApiReachability(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markApiUnavailable(): void {
  listeners.forEach((listener) => listener(false));
}

export function markApiAvailable(): void {
  listeners.forEach((listener) => listener(true));
}

