import JournalApp from "@/components/admin/journal/JournalApp";
import SupabaseJournal from "@/components/admin/legacy/SupabaseJournal";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function JournalPage({
	searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
	if (!cloudflareAdmin()) return <SupabaseJournal />;
	await requireOwner();
	return <JournalApp editId={(await searchParams).edit} />;
}
