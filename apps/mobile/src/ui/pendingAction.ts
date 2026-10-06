// For one mutation shared by every row of a list: only the row whose variables are in flight shows
// the spinner, while the same action stays disabled on the other rows until it settles. That keeps
// a single request in flight (an action is never sent twice, docs/business-rules.md §13.15) and
// stops a second row from replacing the variables the spinner is tracking.
export function pendingActionState<TVariables>(mutation: { isPending: boolean; variables?: TVariables }, isThisAction: (variables: TVariables) => boolean) {
  const loading = mutation.isPending && mutation.variables !== undefined && isThisAction(mutation.variables);
  return { loading, disabled: mutation.isPending && !loading };
}
