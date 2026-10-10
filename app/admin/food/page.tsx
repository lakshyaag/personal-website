import FoodApp from "@/components/admin/food/FoodApp";
import SupabaseFood from "@/components/admin/legacy/SupabaseFood";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function FoodPage({
	searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
	if (!cloudflareAdmin()) return <SupabaseFood />;
	await requireOwner();
	return <FoodApp editId={(await searchParams).edit} />;
}
