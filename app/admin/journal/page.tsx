import JournalApp from "@/components/admin/journal/JournalApp";
import SupabaseJournal from "@/components/admin/legacy/SupabaseJournal";
import { requireOwner } from "@/lib/migration/api";
import { migrationEnabled } from "@/lib/migration/config";

export const dynamic = "force-dynamic";
export default async function JournalPage({
	searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
	if (!migrationEnabled()) return <SupabaseJournal />;
	await requireOwner();
	return <JournalApp editId={(await searchParams).edit} />;
}
