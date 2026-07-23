export type DatePickerMode = "date" | "time";

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  mode?: DatePickerMode;
  minimumDate?: string;
  maximumDate?: string;
  disabled?: boolean;
  onClear?: () => void;
  clearAccessibilityLabel?: string;
};
