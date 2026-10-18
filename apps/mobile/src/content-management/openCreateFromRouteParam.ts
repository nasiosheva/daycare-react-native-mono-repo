// Mories Deo Hutapea,S.E.,S.Kom
export function shouldOpenCreateForm(createParam: string | string[] | undefined, canManage: boolean): boolean {
  const value = Array.isArray(createParam) ? createParam[0] : createParam;
  return canManage && value === "1";
}
