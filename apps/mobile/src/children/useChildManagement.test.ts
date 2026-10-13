// Mories Deo Hutapea,S.E.,S.Kom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
  queryClient: { invalidateQueries: vi.fn() },
  api: {
    childProgramTemplates: vi.fn(), createChildProgramTemplate: vi.fn(), updateChildProgramTemplate: vi.fn(), removeChildProgramTemplate: vi.fn(),
    createChildProgramFromTemplate: vi.fn(), childProfile: vi.fn(), createChild: vi.fn(), updateChild: vi.fn(), deactivateChild: vi.fn(),
    addChildProgram: vi.fn(), updateChildProgram: vi.fn(), removeChildProgram: vi.fn(), addChildProgramStep: vi.fn(), updateChildProgramStep: vi.fn(),
    removeChildProgramStep: vi.fn(), addChildProgramStaffNote: vi.fn(), assignChildStaff: vi.fn(), unassignChildStaff: vi.fn(), bindChildGuardian: vi.fn(), unbindChildGuardian: vi.fn(),
  },
  organizationId: "tenant-1" as string | null,
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.useQuery, useMutation: mocks.useMutation, useQueryClient: mocks.useQueryClient }));
vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ api: mocks.api, organizationId: mocks.organizationId }) }));

import * as childManagement from "./useChildManagement";

const result = { id: "result-1" };
const invalidations = [
  ["children", "tenant-1"],
  ["child-profile", "tenant-1"],
  ["parent-child-profile", "tenant-1"],
];
type QueryOptions = { queryKey: unknown[]; enabled: boolean; queryFn: () => Promise<unknown> };

async function executeMutation(hook: () => unknown, variables: unknown) {
  const options = hook() as { mutationFn: (value: never) => Promise<unknown>; onSuccess: () => void };
  await options.mutationFn(variables as never);
  options.onSuccess();
}

describe("child management hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of Object.values(mocks.api)) method.mockResolvedValue(result);
    mocks.useQuery.mockImplementation((options) => options);
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQueryClient.mockReturnValue(mocks.queryClient);
    mocks.organizationId = "tenant-1";
  });

  it("scopes template and profile queries to the active tenant and disables missing context", async () => {
    const templates = childManagement.useChildProgramTemplates() as unknown as QueryOptions;
    expect(templates.queryKey).toEqual(["child-program-templates", "tenant-1"]);
    expect(templates.enabled).toBe(true);
    await expect(templates.queryFn()).resolves.toEqual(result);

    expect((childManagement.useChildProgramTemplates(false) as unknown as QueryOptions).enabled).toBe(false);
    mocks.organizationId = null;
    expect((childManagement.useChildProgramTemplates() as unknown as QueryOptions).enabled).toBe(false);
    expect((childManagement.useChildProfile(null) as unknown as QueryOptions).enabled).toBe(false);

    mocks.organizationId = "tenant-1";
    const profile = childManagement.useChildProfile("child-1") as unknown as QueryOptions;
    expect(profile.queryKey).toEqual(["child-profile", "tenant-1", "child-1"]);
    await expect(profile.queryFn()).resolves.toEqual(result);
    expect(mocks.api.childProfile).toHaveBeenCalledWith("child-1");
  });

  it("routes child and program mutations and invalidates all affected profile views", async () => {
    const child = { fullName: "Anak" };
    const program = { name: "Kemandirian" };
    const step = { title: "Merapikan mainan" };

    await executeMutation(childManagement.useCreateChild, child);
    await executeMutation(() => childManagement.useUpdateChild("child-1"), child);
    await executeMutation(() => childManagement.useDeactivateChild("child-1"), undefined);
    await executeMutation(() => childManagement.useAddChildProgram("child-1"), program);
    await executeMutation(() => childManagement.useUpdateChildProgram("child-1", "program-1"), program);
    await executeMutation(() => childManagement.useRemoveChildProgram("child-1"), "program-1");
    await executeMutation(() => childManagement.useAddChildProgramStep("child-1", "program-1"), step);
    await executeMutation(() => childManagement.useUpdateChildProgramStep("child-1", "program-1"), { stepId: "step-1", input: step });
    await executeMutation(() => childManagement.useRemoveChildProgramStep("child-1", "program-1"), "step-1");
    await executeMutation(() => childManagement.useAddChildProgramStaffNote("child-1", "program-1"), { note: "Latihan mandiri" });
    await executeMutation(() => childManagement.useAssignChildStaff("child-1"), { userId: "staff-1", assignmentRole: "STAFF" });
    await executeMutation(() => childManagement.useUnassignChildStaff("child-1"), "assignment-1");
    await executeMutation(() => childManagement.useBindChildGuardian("child-1"), "parent@example.test");
    await executeMutation(() => childManagement.useUnbindChildGuardian("child-1"), "parent-1");

    expect(mocks.api.createChild).toHaveBeenCalledWith(child);
    expect(mocks.api.updateChild).toHaveBeenCalledWith("child-1", child);
    expect(mocks.api.deactivateChild).toHaveBeenCalledWith("child-1");
    expect(mocks.api.updateChildProgramStep).toHaveBeenCalledWith("child-1", "program-1", "step-1", step);
    expect(mocks.api.bindChildGuardian).toHaveBeenCalledWith("child-1", "parent@example.test");
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledTimes(14 * invalidations.length);
    for (const queryKey of invalidations) expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("invalidates only the child-program template list after template mutations", async () => {
    const template = { name: "Template", steps: [] };
    await executeMutation(childManagement.useCreateChildProgramTemplate, template);
    await executeMutation(() => childManagement.useUpdateChildProgramTemplate("template-1"), template);
    await executeMutation(childManagement.useRemoveChildProgramTemplate, "template-1");
    await executeMutation(() => childManagement.useCreateChildProgramFromTemplate("child-1"), "template-1");

    expect(mocks.api.createChildProgramTemplate).toHaveBeenCalledWith(template);
    expect(mocks.api.updateChildProgramTemplate).toHaveBeenCalledWith("template-1", template);
    expect(mocks.api.removeChildProgramTemplate).toHaveBeenCalledWith("template-1");
    expect(mocks.api.createChildProgramFromTemplate).toHaveBeenCalledWith("child-1", "template-1");
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["child-program-templates", "tenant-1"] });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledTimes(6);
  });
});
