// Mories Deo Hutapea,S.E.,S.Kom
import { Text, View } from "react-native";
import { ComponentDesignPreview } from "@/ui/ComponentDesignPreview";

export default function ComponentPreviewScreen() {
  if (!__DEV__) return <View><Text>Not found</Text></View>;
  return <ComponentDesignPreview />;
}
