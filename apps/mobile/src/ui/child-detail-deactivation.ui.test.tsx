import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import ChildDetailScreen from "../../app/child-detail";
import { notify } from "@/notify/notify";

// Mories Deo Hutapea,S.E.,S.Kom

const mockReplace = jest.fn();
const mockDeactivate = jest.fn();

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ childId: "child-1" }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: mockReplace }),
}));
jest.mock("@/navigation/AppScreen", () => ({ AppScreen: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/navigation/SafeRedirect", () => ({ SafeRedirect: () => null }));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    api: {},
    organizationId: "org-1",
    profile: { memberships: [{ organizationId: "org-1", role: "STAFF_ADMIN", active: true }] },
  }),
}));
jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock("@/notify/notify", () => ({ notify: jest.fn() }));
jest.mock("@/date-picker/DatePicker", () => ({ DatePicker: () => null }));
jest.mock("@/children/GenderPicker", () => ({ GenderPicker: () => null }));
jest.mock("@/education/useUiAccessContext", () => ({
  hasBranchOfferingCapability: () => false,
  hasLegacyLearningAccess: () => false,
  hasOfferingCapability: () => false,
  useUiAccessContext: () => ({ data: undefined }),
}));
jest.mock("@/children/useChildManagement", () => {
  const mutation = () => ({ isPending: false, mutateAsync: jest.fn().mockResolvedValue(undefined) });
  return {
    useAddChildProgram: mutation,
    useAssignChildStaff: mutation,
    useBindChildGuardian: mutation,
    useChildProfile: () => ({
      data: {
        child: { id: "child-1", fullName: "Anak Contoh", firstName: "Anak", lastName: "Contoh", dateOfBirth: "2022-01-01", gender: "UNSPECIFIED" },
        programs: [],
        staffAssignments: [],
        guardians: [{ userId: "parent-1" }],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
    }),
    useChildProgramTemplates: () => ({ data: [] }),
    useCreateChildProgramFromTemplate: mutation,
    useDeactivateChild: () => ({ isPending: false, mutateAsync: mockDeactivate }),
    useRemoveChildProgram: mutation,
    useUnassignChildStaff: mutation,
    useUnbindChildGuardian: mutation,
    useUpdateChild: mutation,
  };
});
jest.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutateAsync: jest.fn().mockResolvedValue(undefined) }),
  useQuery: () => ({ data: [], isFetching: false, isError: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@daycare/ui", () => {
  const ReactNative = jest.requireActual("react-native");
  const Text = ({ children, ...props }: React.ComponentProps<typeof ReactNative.Text>) => <ReactNative.Text {...props}>{children}</ReactNative.Text>;
  const Button = ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => (
    <ReactNative.Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>{children}</ReactNative.Pressable>
  );
  const BottomSheet = ({ visible, title, children, negativeAction, positiveAction }: { visible: boolean; title: string; children: React.ReactNode; negativeAction?: { label: string; onPress: () => void }; positiveAction?: { label: string; onPress: () => void }; }) => visible ? (
    <ReactNative.View>
      <Text>{title}</Text>
      {children}
      {negativeAction && <Button onPress={negativeAction.onPress}><Text>{negativeAction.label}</Text></Button>}
      {positiveAction && <Button onPress={positiveAction.onPress}><Text>{positiveAction.label}</Text></Button>}
    </ReactNative.View>
  ) : null;
  return {
    AppText: Text,
    Avatar: () => null,
    Badge: () => null,
    BackButton: Button,
    Banner: ({ title }: { title: string }) => <Text>{title}</Text>,
    BottomSheet,
    Button,
    Chip: () => null,
    ChipGroup: () => null,
    EmptyState: () => null,
    ErrorState: () => null,
    MenuItem: () => null,
    MenuSection: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ShimmerList: () => null,
    TextField: () => null,
    colors: { danger: "red", primary: "gold" },
    radius: { sm: 8 },
    spacing: { md: 16, sm: 8, xs: 4 },
  };
});

describe("Child detail deactivation confirmation", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockDeactivate.mockReset().mockResolvedValue(undefined);
    jest.mocked(notify).mockClear();
  });

  it("does not deactivate when canceled and returns to the child list after confirmation", async () => {
    const rendered = render(<ChildDetailScreen />);

    fireEvent.press(rendered.getByText("children.deactivate"));
    expect(rendered.getByText("children.deactivateDescription")).toBeTruthy();
    fireEvent.press(rendered.getByText("common.cancel"));
    expect(mockDeactivate).not.toHaveBeenCalled();

    fireEvent.press(rendered.getByText("children.deactivate"));
    fireEvent.press(rendered.getAllByText("children.deactivate").at(-1)!);

    await waitFor(() => expect(mockDeactivate).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith("/children");
  });

  it("shows an error notification and stays on the page when deactivation fails", async () => {
    mockDeactivate.mockRejectedValue(new Error("offline"));
    const rendered = render(<ChildDetailScreen />);

    fireEvent.press(rendered.getByText("children.deactivate"));
    fireEvent.press(rendered.getAllByText("children.deactivate").at(-1)!);

    await waitFor(() => expect(notify).toHaveBeenCalledWith("children.deactivateFailed", "offline", "danger"));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
