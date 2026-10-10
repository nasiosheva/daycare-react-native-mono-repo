import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import ParentScreeningScreen from "../../app/parent-screening";

// Mories Deo Hutapea,S.E.,S.Kom

const mockMutateAsync = jest.fn().mockResolvedValue({ id: "session-1" });

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/SafeRedirect", () => ({ SafeRedirect: () => null }));
jest.mock("@/date-picker/DatePicker", () => ({ DatePicker: () => null }));
jest.mock("@/notify/notify", () => ({ notify: jest.fn() }));
jest.mock("@/document-export", () => ({ previewDownloadedReport: jest.fn(), saveDownloadedReport: jest.fn(), shareDocumentExport: jest.fn() }));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    profile: { registrationRole: "PARENT" },
    api: {},
  }),
}));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key, locale: "id" }) }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({ isPending: false, mutateAsync: mockMutateAsync }),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    switch (queryKey[0]) {
      case "screening-profiles":
        return { data: [{ id: "profile-1", subjectName: "Anak", dateOfBirth: "2023-01-01" }] };
      case "screening-linked-children":
        return { data: [] };
      case "screening-templates":
        return { data: [{ id: "template-1", minAgeMonths: 0, maxAgeMonths: 24 }] };
      case "screening-sessions":
        return { data: [] };
      default:
        return { data: undefined };
    }
  },
}));

describe("Parent screening Start check flow", () => {
  beforeEach(() => mockMutateAsync.mockClear());

  it("enables and submits Start check only after profile, template, and consent are selected", async () => {
    const rendered = render(<ParentScreeningScreen />);

    fireEvent.press(rendered.getByText("Anak"));
    const startButton = rendered.getByRole("button", { name: "screening.start" });
    expect(startButton).toBeDisabled();

    fireEvent.press(rendered.getByRole("radio", { name: "0–24 bulan" }));
    expect(startButton).toBeDisabled();

    fireEvent.press(rendered.getByRole("radio", { name: "screening.consent" }));
    expect(startButton).toBeEnabled();

    fireEvent.press(startButton);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
  });
});
