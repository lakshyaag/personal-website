import WorkoutDashboard from "@/components/admin/WorkoutDashboard";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function WorkoutDashboardPage() {
	if (!cloudflareAdmin())
		return <WorkoutDashboard statsUrl="/api/workouts/stats" />;
	await requireOwner();
	return <WorkoutDashboard statsUrl="/api/admin/workouts/stats" />;
}
