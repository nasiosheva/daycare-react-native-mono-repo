// Mories Deo Hutapea,S.E.,S.Kom
import { useLocalSearchParams } from "expo-router";
import { InAppBrowserScreen } from "@/browser/InAppBrowserScreen";

export default function InAppBrowserRoute() {
  const { url } = useLocalSearchParams<{ url?: string | string[] }>();
  return <InAppBrowserScreen initialUrl={Array.isArray(url) ? url[0] : url} />;
}
