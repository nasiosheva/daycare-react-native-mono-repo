import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, ShimmerList, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";

export default function ChildConsentsScreen() {
 const router = useRouter(); const { childId } = useLocalSearchParams<{ childId?: string }>(); const { api, organizationId, profile } = useAuth(); const client = useQueryClient(); const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
 const definitions = useQuery({ queryKey: ["consent-definitions", organizationId], queryFn: () => api.consentDefinitions(), enabled: membership?.role === "PARENT" });
 const decide = useMutation({ mutationFn: ({ id, granted }: { id: string; granted: boolean }) => api.decideConsent(childId!, id, granted), onSuccess: () => void client.invalidateQueries({ queryKey: ["consent-definitions", organizationId] }) });
 if (!childId || membership?.role !== "PARENT") return <Redirect href="/home" />;
 return <AppScreen showBottomNavigation={false} title="Persetujuan" header={<BackButton accessibilityLabel="Kembali" onPress={() => router.back()} />}><View style={{ gap: spacing.md }}>{definitions.isLoading && <ShimmerList />}{definitions.data?.map((item) => <View key={item.id} style={{ gap: spacing.sm }}><AppText variant="heading">{item.title}</AppText><AppText tone="muted">{item.content}</AppText><View style={{ flexDirection: "row", gap: spacing.sm }}><Button loading={decide.isPending} onPress={() => void decide.mutateAsync({ id: item.id, granted: true })}>Setuju</Button><Button variant="secondary" loading={decide.isPending} onPress={() => void decide.mutateAsync({ id: item.id, granted: false })}>Tidak setuju</Button></View></View>)}</View></AppScreen>;
}
