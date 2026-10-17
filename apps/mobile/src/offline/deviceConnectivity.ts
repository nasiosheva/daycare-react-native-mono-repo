// Mories Deo Hutapea,S.E.,S.Kom

import * as Network from "expo-network";

export function isDeviceConnected(state: { type?: Network.NetworkStateType; isConnected?: boolean | null }): boolean {
  // Expo also reports isConnected=false for UNKNOWN, so only NONE proves disconnection.
  return state.type !== Network.NetworkStateType.NONE;
}

export function subscribeDeviceConnectivity(listener: (connected: boolean) => void): () => void {
  let active = true;
  let receivedEvent = false;
  const subscription = Network.addNetworkStateListener((state) => {
    receivedEvent = true;
    listener(isDeviceConnected(state));
  });

  void Network.getNetworkStateAsync().then((state) => {
    if (active && !receivedEvent) listener(isDeviceConnected(state));
  }).catch(() => {
    // A failed connectivity probe is inconclusive; do not mark the device offline.
  });

  return () => {
    active = false;
    subscription.remove();
  };
}
