interface PhotoGridProps {
	photos: string[];
	altText?: string;
	editable?: boolean;
	onRemove?: (photoUrl: string) => void;
	columns?: number;
}

export function PhotoGrid({
	photos,
	altText = "Photo",
	editable = false,
	onRemove,
	columns = 4,
}: PhotoGridProps) {
	if (!photos || photos.length === 0) return null;

	const gridClass = `grid grid-cols-3 gap-2 sm:grid-cols-${columns}`;

	return (
		<div className={gridClass}>
			{photos.map((photo) => (
				<div key={photo} className="relative">
					<img
						src={photo}
						alt={altText}
						className="h-20 w-full rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
						onClick={() => window.open(photo, "_blank")}
					/>
					{editable && onRemove && (
						<button
							type="button"
							onClick={() => onRemove(photo)}
							className="absolute right-1 top-1 rounded-full bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
						>
							×
						</button>
					)}
				</div>
			))}
		</div>
	);
}
