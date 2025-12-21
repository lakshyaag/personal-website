export function ChartEmptyState({
	message = "No workout data yet",
}: { message?: string }) {
	return <p className="text-center text-zinc-500 py-8">{message}</p>;
}
