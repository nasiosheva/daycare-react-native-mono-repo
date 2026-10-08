import { useEffect } from "react";
import { type Href, useRootNavigationState, useRouter } from "expo-router";

type SafeRedirectProps = {
  href: Href;
  /**
   * Pops every pushed screen off the stack before replacing, so nothing
   * authenticated is left behind the target for hardware/gesture back to pop
   * into. Use for leaving an authenticated session (e.g. redirecting to
   * /sign-in after logout or session loss) — a plain replace only swaps the
   * current screen and would leave a stale screen in history.
   */
  dismissStack?: boolean;
};

export function SafeRedirect({ href, dismissStack }: SafeRedirectProps) {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;
    // canDismiss() guards an empty stack (e.g. a fresh load landing straight
    // on /sign-in): dismissAll() is a no-op there, but on web it logs a
    // dev-only "POP_TO_TOP was not handled" console error if nothing is
    // actually pushed.
    if (dismissStack && router.canDismiss()) router.dismissAll();
    router?.replace(href);
  }, [dismissStack, href, navigationState?.key, router]);

  return null;
}
