"use client";

interface EntryCardProps {
	children: React.ReactNode;
	onEdit?: () => void;
	onDelete?: () => void;
	className?: string;
}

export function EntryCard({
	children,
	onEdit,
	onDelete,
	className = "",
}: EntryCardProps) {
	return (
		<div
			className={`rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50 ${className}`.trim()}
		>
			<div className="flex items-start justify-between">
				<div className="flex-1">{children}</div>
				{(onEdit || onDelete) && (
					<div className="flex gap-2 ml-4">
						{onEdit && (
							<button
								type="button"
								onClick={onEdit}
								className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
							>
								Edit
							</button>
						)}
						{onDelete && (
							<button
								type="button"
								onClick={onDelete}
								className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
							>
								Delete
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

interface EntryCardListProps {
	children: React.ReactNode;
	className?: string;
}

export function EntryCardList({ children, className = "" }: EntryCardListProps) {
	return <div className={`space-y-2 ${className}`.trim()}>{children}</div>;
}

