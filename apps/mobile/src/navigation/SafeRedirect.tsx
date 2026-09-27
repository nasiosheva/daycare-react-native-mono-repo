import { useEffect } from "react";
import { type Href, useRootNavigationState, useRouter } from "expo-router";

export function SafeRedirect({ href }: { href: Href }) {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;
    router?.replace(href);
  }, [href, navigationState?.key, router]);

  return null;
}
