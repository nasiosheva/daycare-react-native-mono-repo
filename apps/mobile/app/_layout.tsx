import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState, type PropsWithChildren } from "react";
import { AuthProvider } from "@/auth/AuthProvider";

function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}

export default function RootLayout() {
  return <Providers><Stack screenOptions={{ headerShown: false }} /></Providers>;
}
