import AirportsApp from "@/components/admin/airports/AirportsApp";
import SupabaseAirports from "@/components/admin/legacy/SupabaseAirports";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function AirportsPage() {
	if (!cloudflareAdmin()) return <SupabaseAirports />;
	await requireOwner();
	return <AirportsApp />;
}
