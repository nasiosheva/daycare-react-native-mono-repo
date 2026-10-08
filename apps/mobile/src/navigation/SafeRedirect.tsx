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
    if (dismissStack) router.dismissAll();
    router?.replace(href);
  }, [dismissStack, href, navigationState?.key, router]);

  return null;
}
