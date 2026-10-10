import BooksApp from "@/components/admin/books/BooksApp";
import SupabaseBooks from "@/components/admin/legacy/SupabaseBooks";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function BooksPage() {
	if (!cloudflareAdmin()) return <SupabaseBooks />;
	await requireOwner();
	return <BooksApp />;
}
