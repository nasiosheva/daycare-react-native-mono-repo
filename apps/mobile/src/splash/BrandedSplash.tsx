import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Polygon } from "react-native-svg";
import { appBrandNameUppercase, appCopyright, backgroundGradient, colors } from "@daycare/ui";

type BrandedSplashProps = {
  onLogoLoad: () => void;
};

function SplashSunburst() {
  return <View style={styles.sunburst} pointerEvents="none">
    <Svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      <Circle cx="540" cy="700" r="638" fill={colors.primary} fillOpacity={0.08} />
      <Polygon points="514,700 35,628 35,772" fill={colors.primary} fillOpacity={0.12} />
      <Polygon points="514,700 100,445 173,330" fill={colors.primary} fillOpacity={0.12} />
      <Polygon points="514,700 285,260 420,195" fill={colors.primary} fillOpacity={0.12} />
      <Polygon points="514,700 468,195 612,195" fill={colors.primary} fillOpacity={0.12} />
      <Polygon points="566,700 795,260 660,195" fill={colors.primary} fillOpacity={0.12} />
      <Polygon points="566,700 980,445 907,330" fill={colors.primary} fillOpacity={0.12} />
      <Polygon points="566,700 1045,628 1045,772" fill={colors.primary} fillOpacity={0.12} />
      <Polygon points="566,700 980,955 907,1070" fill={colors.primary} fillOpacity={0.1} />
      <Polygon points="566,700 795,1140 660,1205" fill={colors.primary} fillOpacity={0.09} />
      <Polygon points="514,700 612,1205 468,1205" fill={colors.primary} fillOpacity={0.09} />
      <Polygon points="514,700 285,1140 420,1205" fill={colors.primary} fillOpacity={0.09} />
      <Polygon points="514,700 100,955 173,1070" fill={colors.primary} fillOpacity={0.1} />
    </Svg>
  </View>;
}

export function BrandedSplash({ onLogoLoad }: BrandedSplashProps) {
  return <View style={styles.container} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <LinearGradient colors={backgroundGradient.colors} locations={backgroundGradient.locations} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.background}>
      <SplashSunburst />
      <View style={styles.content}>
        <Image source={require("../../assets/images/login-icon.png")} style={styles.logo} resizeMode="contain" onLoadEnd={onLogoLoad} />
        <View style={styles.copy}>
          <Text style={styles.brand}>{appBrandNameUppercase}</Text>
          <Text style={styles.tagline}>Tumbuh, Main, dan Belajar</Text>
          <Text style={styles.copyright}>{appCopyright}</Text>
        </View>
      </View>
    </LinearGradient>
  </View>;
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background },
  background: { flex: 1 },
  sunburst: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logo: { width: "45%", maxWidth: 320, height: "43%", maxHeight: 560, marginTop: -92 },
  copy: { alignItems: "center", marginTop: -8 },
  brand: { color: colors.primary, fontSize: 42, fontWeight: "800", letterSpacing: 3.5, textAlign: "center" },
  tagline: { color: colors.text, fontSize: 22, marginTop: 10, textAlign: "center" },
  copyright: { color: colors.muted, fontSize: 14, marginTop: 18, textAlign: "center" },
});
