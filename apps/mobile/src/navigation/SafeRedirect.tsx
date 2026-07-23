import { useEffect } from "react";
import { type Href, useRouter } from "expo-router";

export function SafeRedirect({ href }: { href: Href }) {
  const router = useRouter();

  useEffect(() => {
    router?.replace(href);
  }, [href, router]);

  return null;
}
