export const parentEnrollmentQueryKey = (userId: string | null | undefined) => ["parent-enrollments", "self", userId] as const;

export const parentEnrollmentCatalogQueryKey = (userId: string | null | undefined) => ["parent-enrollment-catalog", userId] as const;
