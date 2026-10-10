import SupabaseWorkouts from "@/components/admin/legacy/SupabaseWorkouts";
import WorkoutsApp from "@/components/admin/workouts/WorkoutsApp";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function WorkoutsPage() {
	if (!cloudflareAdmin()) return <SupabaseWorkouts />;
	await requireOwner();
	return <WorkoutsApp />;
}
