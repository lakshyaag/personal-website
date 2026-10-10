import SupabasePhotos from "@/components/admin/legacy/SupabasePhotos";
import PhotoLibrary from "@/components/admin/photos/PhotoLibrary";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function PhotosPage() {
	if (!cloudflareAdmin()) return <SupabasePhotos />;
	await requireOwner();
	return <PhotoLibrary />;
}
