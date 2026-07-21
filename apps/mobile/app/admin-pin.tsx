import { useState } from "react";
import { Alert } from "react-native";
import { Redirect, router } from "expo-router";
import { BackButton, PinEntryScreen } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

type Step = "new" | "confirm";

export default function AdminPinScreen() {
  const { api, profile, isSimulationSession } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("new");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");

  if (!profile?.isPlatformAdmin) return <Redirect href="/home" />;

  const handleNewPin = (pin: string) => {
    setNewPin(pin);
    setConfirmation("");
    setStep("confirm");
  };
  const handleConfirmation = async (pin: string) => {
    setConfirmation(pin);
    if (pin !== newPin) {
      setConfirmation("");
      Alert.alert(t("pin.mismatch"), t("pin.mismatchDescription"));
      return;
    }
    if (isSimulationSession) return Alert.alert(t("pin.unavailable"), t("pin.simulation"));
    try {
      await api.changePlatformAdminPin(pin);
      Alert.alert(t("pin.changed"), t("pin.changedDescription"), [{ text: t("common.ok"), onPress: () => router.replace("/profile") }]);
    } catch (error) {
      setConfirmation("");
      Alert.alert(t("pin.failed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  const confirming = step === "confirm";
  return <PinEntryScreen
    header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}
    title={confirming ? t("pin.confirm") : t("pin.create")}
    description={confirming ? t("pin.confirmDescription") : t("pin.createDescription")}
    value={confirming ? confirmation : newPin}
    onChange={confirming ? setConfirmation : setNewPin}
    pinLength={6}
    enteredDigitsAccessibilityLabel={t("pin.enteredDigits", { count: confirming ? confirmation.length : newPin.length, length: 6 })}
    deleteAccessibilityLabel={t("pin.delete")}
    onComplete={confirming ? (pin) => void handleConfirmation(pin) : handleNewPin}
  />;
}
