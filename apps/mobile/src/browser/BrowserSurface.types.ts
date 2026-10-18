// Mories Deo Hutapea,S.E.,S.Kom
import type { Ref } from "react";

export type BrowserNavigationState = { url: string; title?: string; loading?: boolean; canGoBack: boolean; canGoForward: boolean };
export type BrowserSurfaceHandle = { goBack: () => void; goForward: () => void; reload: () => void };
export type BrowserSurfaceProps = {
  url: string;
  accessibilityLabel: string;
  onNavigationStateChange: (state: BrowserNavigationState) => void;
  onLoadError: () => void;
  surfaceRef: Ref<BrowserSurfaceHandle>;
};
