import { capabilitiesForInstitutionTypes, type CurrentUser, type Role } from "@daycare/core";
import type { AuthUser } from "./types";

const simulationOrganization = {
  id: "simulation-daycare",
  name: "Umur Emas Simulasi",
} as const;

const simulationRoles: Record<Role, { label: string; displayName: string }> = {
  ADMIN: { label: "Admin", displayName: "Admin Simulasi" },
  STAFF_ADMIN: { label: "Staff admin", displayName: "Staff Admin Simulasi" },
  STAFF: { label: "Staf", displayName: "Staf Simulasi" },
  PARENT: { label: "Orang tua", displayName: "Orang Tua Simulasi" },
};

export type SimulationSession = {
  user: AuthUser;
  profile: CurrentUser;
};

export const simulationRoleOptions = (Object.entries(simulationRoles) as [Role, (typeof simulationRoles)[Role]][]).map(([role, details]) => ({ role, ...details }));

export function createSimulationSession(role: Role): SimulationSession {
  const details = simulationRoles[role];
  const id = `simulation-${role.toLowerCase()}`;
  return {
    user: { uid: id, email: `${role.toLowerCase()}@simulation.local`, phoneNumber: null, displayName: details.displayName },
    profile: {
      id,
      displayName: details.displayName,
      gender: "UNSPECIFIED",
      registrationRole: role === "PARENT" ? "PARENT" : undefined,
      isPlatformAdmin: role === "ADMIN",
      memberships: [{ organizationId: simulationOrganization.id, organizationName: simulationOrganization.name, role, active: true, canManageChildPrograms: false, canManageDevelopmentCategories: false, institutionTypes: ["DAYCARE"], capabilities: capabilitiesForInstitutionTypes(["DAYCARE"]) }],
    },
  };
}
