"use client";

import { useMemo, useState } from "react";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnDef,
	type ColumnFiltersState,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, Columns3, MoreHorizontal, PlusCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	PhotoLightbox,
	type PhotoViewerItem,
} from "@/components/photos/PhotoLightbox";
import { PhotoThumbnailCell } from "./PhotoThumbnailCell";
import {
	type AdminPhotoItem,
	contextLabel,
	formatGps,
	formatTimestamp,
} from "./types";

interface PhotosDataTableProps {
	photos: AdminPhotoItem[];
	onRowClick: (photo: AdminPhotoItem) => void;
	onDelete: (photo: AdminPhotoItem) => void;
}

function toLightboxItem(photo: AdminPhotoItem): PhotoViewerItem {
	return {
		ref: photo.displayRef,
		thumbnailRef: photo.thumbnailRef,
		alt: photo.title ?? "Photo",
		caption: photo.caption ?? photo.title ?? undefined,
	};
}

function SortHeader({
	label,
	column,
}: {
	label: string;
	column: {
		toggleSorting: (desc?: boolean) => void;
		getIsSorted: () => false | "asc" | "desc";
	};
}) {
	return (
		<Button
			variant="ghost"
			size="sm"
			className="-ml-2 h-8"
			onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
		>
			{label}
			<ArrowUpDown className="size-3.5 opacity-60" />
		</Button>
	);
}

function ToolbarFilter({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: { label: string; value: string }[];
	onChange: (value: string | undefined) => void;
}) {
	const active = Boolean(value);
	const activeLabel =
		options.find((option) => option.value === value)?.label ?? value;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5 border-dashed"
					/>
				}
			>
				<PlusCircle className="size-3.5" />
				{label}
				{active && (
					<>
						<span className="mx-0.5 text-muted-foreground">·</span>
						<Badge variant="secondary" className="rounded-sm px-1 font-normal">
							{activeLabel}
						</Badge>
					</>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-44">
				<DropdownMenuRadioGroup
					value={value || "all"}
					onValueChange={(next) =>
						onChange(!next || next === "all" ? undefined : next)
					}
				>
					<DropdownMenuGroup>
						<DropdownMenuLabel>{label}</DropdownMenuLabel>
						<DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
						{options.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value}>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function PhotosDataTable({
	photos,
	onRowClick,
	onDelete,
}: PhotosDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "createdAt", desc: true },
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
		caption: false,
		gps: false,
		gpsPublic: false,
		dimensions: false,
	});
	const [globalFilter, setGlobalFilter] = useState("");
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

	const lightboxPhotos = useMemo(
		() => photos.map(toLightboxItem),
		[photos],
	);

	const columns = useMemo<ColumnDef<AdminPhotoItem>[]>(
		() => [
			{
				id: "thumbnail",
				header: "",
				enableHiding: false,
				cell: ({ row }) => (
					<PhotoThumbnailCell
						photoRef={row.original.thumbnailRef ?? row.original.displayRef}
						alt={row.original.title ?? "Photo"}
						onClick={() => {
							const index = photos.findIndex(
								(photo) => photo.id === row.original.id,
							);
							if (index >= 0) setLightboxIndex(index);
						}}
					/>
				),
			},
			{
				accessorKey: "title",
				header: ({ column }) => <SortHeader label="Title" column={column} />,
				cell: ({ row }) => (
					<span className="block max-w-[10rem] truncate font-medium">
						{row.original.title ?? "—"}
					</span>
				),
			},
			{
				accessorKey: "caption",
				header: "Caption",
				cell: ({ row }) => (
					<span className="block max-w-[12rem] truncate text-muted-foreground">
						{row.original.caption ?? "—"}
					</span>
				),
			},
			{
				accessorKey: "locationLabel",
				header: "Location",
				cell: ({ row }) => (
					<span className="block max-w-[9rem] truncate">
						{row.original.locationLabel ?? "—"}
					</span>
				),
			},
			{
				accessorKey: "visibility",
				header: ({ column }) => (
					<SortHeader label="Visibility" column={column} />
				),
				filterFn: (row, id, value: string) => row.getValue(id) === value,
				cell: ({ row }) => (
					<Badge variant="secondary" className="capitalize">
						{row.original.visibility}
					</Badge>
				),
			},
			{
				accessorKey: "galleryFeatured",
				header: ({ column }) => <SortHeader label="Featured" column={column} />,
				filterFn: (row, id, value: string) =>
					String(row.getValue(id)) === value,
				cell: ({ row }) => (
					<Badge variant={row.original.galleryFeatured ? "default" : "outline"}>
						{row.original.galleryFeatured ? "Yes" : "No"}
					</Badge>
				),
			},
			{
				id: "gps",
				header: "GPS",
				accessorFn: (row) => formatGps(row) ?? "",
				cell: ({ row }) => (
					<span className="block max-w-[10rem] truncate text-xs text-muted-foreground">
						{formatGps(row.original) ?? "—"}
					</span>
				),
			},
			{
				accessorKey: "gpsPublic",
				header: "GPS public",
				cell: ({ row }) => (
					<Badge variant="outline">
						{row.original.gpsPublic ? "Public" : "Hidden"}
					</Badge>
				),
			},
			{
				id: "dimensions",
				header: "Size",
				accessorFn: (row) =>
					row.width && row.height ? `${row.width}x${row.height}` : "",
				cell: ({ row }) =>
					row.original.width && row.original.height
						? `${row.original.width} × ${row.original.height}`
						: "—",
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<SortHeader label="Uploaded" column={column} />
				),
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground">
						{formatTimestamp(row.original.createdAt)}
					</span>
				),
			},
			{
				accessorKey: "takenAt",
				header: ({ column }) => <SortHeader label="Taken" column={column} />,
				sortingFn: (a, b) => {
					const aTime = a.original.takenAt
						? new Date(a.original.takenAt).getTime()
						: 0;
					const bTime = b.original.takenAt
						? new Date(b.original.takenAt).getTime()
						: 0;
					return aTime - bTime;
				},
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground">
						{formatTimestamp(row.original.takenAt)}
					</span>
				),
			},
			{
				id: "source",
				header: ({ column }) => <SortHeader label="Source" column={column} />,
				accessorFn: (row) =>
					[contextLabel(row.contextType), row.contextId]
						.filter(Boolean)
						.join(" "),
				cell: ({ row }) => (
					<div className="min-w-0 space-y-0.5">
						<Badge variant="outline">
							{contextLabel(row.original.contextType)}
						</Badge>
						{row.original.contextId ? (
							<p className="truncate font-mono text-[11px] text-muted-foreground">
								{row.original.contextId}
							</p>
						) : null}
					</div>
				),
			},
			{
				id: "actions",
				enableHiding: false,
				header: "",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									onClick={(event) => event.stopPropagation()}
								/>
							}
						>
							<MoreHorizontal className="size-4" />
							<span className="sr-only">Open menu</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							<DropdownMenuItem
								variant="destructive"
								onClick={(event) => {
									event.stopPropagation();
									onDelete(row.original);
								}}
							>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
			},
		],
		[onDelete, photos],
	);

	const table = useReactTable({
		data: photos,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			globalFilter,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: {
			pagination: { pageSize: 25 },
		},
		globalFilterFn: (row, _columnId, filterValue) => {
			const query = String(filterValue).toLowerCase().trim();
			if (!query) return true;
			const photo = row.original;
			const haystack = [
				photo.title,
				photo.caption,
				photo.locationLabel,
				photo.visibility,
				photo.contextId,
				contextLabel(photo.contextType),
				formatGps(photo),
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return haystack.includes(query);
		},
	});

	const visibilityFilter =
		(table.getColumn("visibility")?.getFilterValue() as string | undefined) ??
		"";
	const featuredFilter =
		(table
			.getColumn("galleryFeatured")
			?.getFilterValue() as string | undefined) ?? "";
	const hasActiveFilters =
		Boolean(visibilityFilter) || Boolean(featuredFilter) || Boolean(globalFilter);

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex flex-1 flex-wrap items-center gap-2">
					<Input
						placeholder="Search title, caption, location, source..."
						value={globalFilter}
						onChange={(event) => setGlobalFilter(event.target.value)}
						className="max-w-sm"
					/>
					<ToolbarFilter
						label="Visibility"
						value={visibilityFilter}
						options={[
							{ label: "Private", value: "private" },
							{ label: "Unlisted", value: "unlisted" },
							{ label: "Public", value: "public" },
						]}
						onChange={(value) =>
							table.getColumn("visibility")?.setFilterValue(value)
						}
					/>
					<ToolbarFilter
						label="Featured"
						value={featuredFilter}
						options={[
							{ label: "Yes", value: "true" },
							{ label: "No", value: "false" },
						]}
						onChange={(value) =>
							table.getColumn("galleryFeatured")?.setFilterValue(value)
						}
					/>
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							className="gap-1.5"
							onClick={() => {
								setGlobalFilter("");
								table.resetColumnFilters();
							}}
						>
							Reset
							<X className="size-3.5" />
						</Button>
					)}
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button variant="outline" size="sm" className="gap-1.5" />}
					>
						<Columns3 className="size-3.5" />
						Columns
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
							{table
								.getAllColumns()
								.filter((column) => column.getCanHide())
								.map((column) => (
									<DropdownMenuCheckboxItem
										key={column.id}
										checked={column.getIsVisible()}
										onCheckedChange={(value) =>
											column.toggleVisibility(value === true)
										}
										className="capitalize"
									>
										{column.id}
									</DropdownMenuCheckboxItem>
								))}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="rounded-xl border border-border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className="cursor-pointer"
									onClick={() => onRowClick(row.original)}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center text-muted-foreground"
								>
									No photos match the selected filters.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between gap-2">
				<p className="text-xs text-muted-foreground">
					{table.getFilteredRowModel().rows.length} photo
					{table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
					{" · "}
					page {table.getState().pagination.pageIndex + 1} of{" "}
					{Math.max(table.getPageCount(), 1)}
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
					</Button>
				</div>
			</div>

			<PhotoLightbox
				photos={lightboxPhotos}
				index={lightboxIndex}
				onClose={() => setLightboxIndex(null)}
				onIndexChange={setLightboxIndex}
			/>
		</div>
	);
}
