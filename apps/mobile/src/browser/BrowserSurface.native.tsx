// Mories Deo Hutapea,S.E.,S.Kom
import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { isValidHttpsUrl } from "@/media/imageUrl";
import type { BrowserNavigationState, BrowserSurfaceHandle, BrowserSurfaceProps } from "./BrowserSurface.types";

function BrowserSurfaceNative({ url, accessibilityLabel, onNavigationStateChange, onLoadError, surfaceRef }: BrowserSurfaceProps) {
  const webViewRef = useRef<WebView>(null);
  useImperativeHandle(surfaceRef, () => ({
    goBack: () => webViewRef.current?.goBack(),
    goForward: () => webViewRef.current?.goForward(),
    reload: () => webViewRef.current?.reload(),
  }), []);
  const onNavigation = (state: WebViewNavigation) => {
    const nextState: BrowserNavigationState = {
      url: state.url,
      title: state.title,
      loading: state.loading,
      canGoBack: state.canGoBack,
      canGoForward: state.canGoForward,
    };
    onNavigationStateChange(nextState);
  };

  return <WebView
    ref={webViewRef}
    accessibilityLabel={accessibilityLabel}
    source={{ uri: url }}
    style={styles.webView}
    originWhitelist={["*"]}
    onShouldStartLoadWithRequest={(request) => isValidHttpsUrl(request.url)}
    onNavigationStateChange={onNavigation}
    onError={onLoadError}
    onHttpError={(event) => { if (event.nativeEvent.statusCode >= 400) onLoadError(); }}
    javaScriptEnabled
    domStorageEnabled
    allowsBackForwardNavigationGestures
    setSupportMultipleWindows={false}
    javaScriptCanOpenWindowsAutomatically={false}
    mixedContentMode="never"
  />;
}

const BrowserSurface = forwardRef<BrowserSurfaceHandle, Omit<BrowserSurfaceProps, "surfaceRef">>((props, ref) => <BrowserSurfaceNative {...props} surfaceRef={ref} />);
BrowserSurface.displayName = "BrowserSurface";
export { BrowserSurface };

const styles = StyleSheet.create({ webView: { flex: 1, backgroundColor: "transparent" } });
