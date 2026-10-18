// Mories Deo Hutapea,S.E.,S.Kom
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppText, BackButton, Banner, Button, colors, radius, spacing, TextField } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { normalizeBrowserUrl } from "./normalizeBrowserUrl";
import { BrowserSurface } from "./BrowserSurface";
import type { BrowserNavigationState, BrowserSurfaceHandle } from "./BrowserSurface.types";

export function InAppBrowserScreen({ initialUrl }: { initialUrl?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const browserRef = useRef<BrowserSurfaceHandle>(null);
  const firstUrl = initialUrl ? normalizeBrowserUrl(initialUrl) : null;
  const [address, setAddress] = useState(firstUrl ?? initialUrl ?? "");
  const [loadedUrl, setLoadedUrl] = useState(firstUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(Boolean(firstUrl));
  const [error, setError] = useState(initialUrl && !firstUrl ? t("browser.invalidUrl") : "");

  const onNavigationStateChange = (state: BrowserNavigationState) => {
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
    if (state.url && normalizeBrowserUrl(state.url)) setAddress(state.url);
    setLoading(Boolean(state.loading));
  };
  useEffect(() => {
    if (Platform.OS !== "android" || !canGoBack) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      browserRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  const submitAddress = () => {
    const url = normalizeBrowserUrl(address);
    if (!url) {
      setError(t("browser.invalidUrl"));
      return;
    }
    setError("");
    setAddress(url);
    setLoadedUrl(url);
    setCanGoBack(false);
    setCanGoForward(false);
    setLoading(true);
  };
  const onLoadError = useCallback(() => {
    setLoading(false);
    setError(t("browser.loadFailed"));
  }, [t]);
  const browserControl = (icon: "chevron-back" | "chevron-forward" | "refresh", label: string, onPress: () => void, disabled = false) => <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.control, disabled && styles.controlDisabled, pressed && styles.controlPressed]}
  ><Ionicons name={icon} size={21} color={disabled ? colors.muted : colors.primary} /></Pressable>;

  return <AppScreen
    title={t("browser.title")}
    showBottomNavigation={false}
    header={<BackButton accessibilityLabel={t("browser.close")} onPress={() => router.back()} />}
    renderBody={(bodyProps) => <View style={[bodyProps.style, styles.layout]}>
      <View style={styles.toolbar}>
        <View style={styles.navigationControls}>
          {browserControl("chevron-back", t("browser.back"), () => browserRef.current?.goBack(), !canGoBack)}
          {browserControl("chevron-forward", t("browser.forward"), () => browserRef.current?.goForward(), !canGoForward)}
          {browserControl("refresh", t("browser.reload"), () => { setError(""); setLoading(true); browserRef.current?.reload(); }, !loadedUrl)}
        </View>
        <View style={styles.addressRow}>
          <TextField
            accessibilityLabel={t("browser.address")}
            placeholder={t("browser.urlPlaceholder")}
            leadingIcon="globe-outline"
            value={address}
            onChangeText={(value) => { setAddress(value); if (error) setError(""); }}
            onSubmitEditing={submitAddress}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            clearable
            clearAccessibilityLabel={t("common.clearText")}
            containerStyle={styles.addressField}
          />
          <Button accessibilityLabel={t("browser.go")} style={styles.goButton} onPress={submitAddress}>{t("browser.go")}</Button>
        </View>
      </View>
      {error ? <Banner tone="danger" title={error} style={styles.error} /> : null}
      {loadedUrl
        ? <View style={styles.surfaceContainer}>
          <BrowserSurface
            key={loadedUrl}
            ref={browserRef}
            url={loadedUrl}
            accessibilityLabel={t("browser.webContent")}
            onNavigationStateChange={onNavigationStateChange}
            onLoadError={onLoadError}
          />
          {loading && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.primary} /><AppText variant="caption" tone="muted">{t("browser.loading")}</AppText></View>}
        </View>
        : <View style={styles.empty}><AppText tone="muted">{t("browser.enterUrl")}</AppText></View>}
    </View>}
  />;
}

const styles = StyleSheet.create({
  layout: { flex: 1, gap: spacing.sm, paddingBottom: spacing.md },
  toolbar: { gap: spacing.sm },
  navigationControls: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  control: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  controlDisabled: { opacity: 0.45 },
  controlPressed: { opacity: 0.7 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  addressField: { flex: 1 },
  goButton: { minWidth: 68 },
  error: { marginBottom: spacing.xs },
  surfaceContainer: { flex: 1, minHeight: 300, overflow: "hidden", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  loading: { position: "absolute", top: spacing.md, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surface },
  empty: { flex: 1, minHeight: 300, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
