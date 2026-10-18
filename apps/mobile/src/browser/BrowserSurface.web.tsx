// Mories Deo Hutapea,S.E.,S.Kom
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import { StyleSheet, View } from "react-native";
import type { BrowserNavigationState, BrowserSurfaceHandle, BrowserSurfaceProps } from "./BrowserSurface.types";
import { isSecureBrowserOrigin } from "./isSecureBrowserOrigin";

function BrowserSurfaceWeb({ url, accessibilityLabel, onNavigationStateChange, onLoadError, surfaceRef }: BrowserSurfaceProps) {
  const secureOrigin = typeof window !== "undefined" && isSecureBrowserOrigin(window.location.protocol, window.location.hostname);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const historyDepth = useRef(0);
  const canGoForward = useRef(false);
  const historyAction = useRef<"back" | "forward" | "reload" | null>(null);
  useEffect(() => {
    if (!secureOrigin) onLoadError();
  }, [onLoadError, secureOrigin]);
  useImperativeHandle(surfaceRef, () => ({
    goBack: () => {
      if (historyDepth.current <= 1) return;
      historyDepth.current -= 1;
      canGoForward.current = true;
      historyAction.current = "back";
      onNavigationStateChange({ url, canGoBack: historyDepth.current > 1, canGoForward: true });
      frameRef.current?.contentWindow?.history.back();
    },
    goForward: () => {
      if (!canGoForward.current) return;
      historyDepth.current += 1;
      canGoForward.current = false;
      historyAction.current = "forward";
      onNavigationStateChange({ url, canGoBack: historyDepth.current > 1, canGoForward: false });
      frameRef.current?.contentWindow?.history.forward();
    },
    reload: () => { historyAction.current = "reload"; setReloadKey((key) => key + 1); },
  }), [onNavigationStateChange, url]);
  const onLoad = () => {
    const action = historyAction.current;
    historyAction.current = null;
    if (action === null) {
      historyDepth.current += 1;
      canGoForward.current = false;
    } else if (action === "forward") {
      canGoForward.current = false;
    }
    const nextState: BrowserNavigationState = { url, canGoBack: historyDepth.current > 1, canGoForward: canGoForward.current };
    onNavigationStateChange(nextState);
  };

  if (!secureOrigin) return <View style={styles.frameContainer} />;

  return <View style={styles.frameContainer}>
    <iframe
      key={`${url}:${reloadKey}`}
      ref={frameRef}
      title={accessibilityLabel}
      src={url}
      onLoad={onLoad}
      onError={onLoadError}
      style={frameStyle}
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-forms allow-scripts"
    />
  </View>;
}

const BrowserSurface = forwardRef<BrowserSurfaceHandle, Omit<BrowserSurfaceProps, "surfaceRef">>((props, ref) => <BrowserSurfaceWeb {...props} surfaceRef={ref} />);
BrowserSurface.displayName = "BrowserSurface";
export { BrowserSurface };

const styles = StyleSheet.create({
  frameContainer: { flex: 1, overflow: "hidden", backgroundColor: "transparent" },
});
const frameStyle: CSSProperties = { width: "100%", height: "100%", border: 0 };
