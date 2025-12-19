"use client";

import { PhotoGrid } from "@/components/admin/PhotoDisplay";

interface EntryCardProps {
	title?: React.ReactNode;
	meta?: React.ReactNode;
	body?: React.ReactNode;
	photos?: string[];
	onPhotoClick?: (url: string) => void;
	actions?: React.ReactNode;
	children?: React.ReactNode;
	onEdit?: () => void;
	onDelete?: () => void;
	className?: string;
}

type EntryCardActionVariant = "neutral" | "success" | "danger";

interface EntryCardActionButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	variant?: EntryCardActionVariant;
	className?: string;
}

export function EntryCardActionButton({
	children,
	onClick,
	variant = "neutral",
	className = "",
}: EntryCardActionButtonProps) {
	const base =
		"px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap";

	const variantClass =
		variant === "success"
			? "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
			: variant === "danger"
				? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
				: "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700";

	return (
		<button
			type="button"
			onClick={onClick}
			className={`${base} ${variantClass} ${className}`.trim()}
		>
			{children}
		</button>
	);
}

export function EntryCard({
	title,
	meta,
	body,
	photos,
	onPhotoClick,
	actions,
	children,
	onEdit,
	onDelete,
	className = "",
}: EntryCardProps) {
	const resolvedOnPhotoClick =
		onPhotoClick ?? ((url: string) => window.open(url, "_blank"));

	const resolvedActions =
		actions ??
		(onEdit || onDelete ? (
			<div className="flex flex-col gap-2 ml-4 flex-shrink-0">
				{onEdit && (
					<EntryCardActionButton onClick={onEdit} variant="neutral">
						Edit
					</EntryCardActionButton>
				)}
				{onDelete && (
					<EntryCardActionButton onClick={onDelete} variant="danger">
						Delete
					</EntryCardActionButton>
				)}
			</div>
		) : null);

	return (
		<div
			className={`rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50 ${className}`.trim()}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					{title != null && (
						<div className="font-medium dark:text-zinc-100">{title}</div>
					)}
					{meta != null && (
						<div className="text-sm text-zinc-600 dark:text-zinc-400">
							{meta}
						</div>
					)}
					{body != null && (
						<div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
							{body}
						</div>
					)}
					{photos && photos.length > 0 && (
						<PhotoGrid photos={photos} onPhotoClick={resolvedOnPhotoClick} />
					)}
					{children}
				</div>
				{resolvedActions}
			</div>
		</div>
	);
}

interface EntryCardListProps {
	children: React.ReactNode;
	className?: string;
}

export function EntryCardList({
	children,
	className = "",
}: EntryCardListProps) {
	return <div className={`space-y-2 ${className}`.trim()}>{children}</div>;
}
