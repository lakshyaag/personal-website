import JournalApp from "@/components/admin/journal/JournalApp";

export default async function JournalPage({
	searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
	return <JournalApp editId={(await searchParams).edit} />;
}
