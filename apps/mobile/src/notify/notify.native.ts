import { Alert } from "react-native";
import type { InlineFeedbackTone } from "@daycare/ui";

export function notify(title: string, message?: string, _tone?: InlineFeedbackTone): void {
  Alert.alert(title, message);
}
