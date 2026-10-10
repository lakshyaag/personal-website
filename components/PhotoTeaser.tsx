"use client";

import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import { buildPhotoViewerItem } from "@/components/photos/buildPhotoViewerItem";
import { SvgArrowRight } from "@/components/ui/svg-arrow-right";
import type { PublicPhoto } from "@/lib/public-types";
import Link from "next/link";

export function PhotoTeaser({ photos }: { photos: PublicPhoto[] }) {
	return (
		<section>
			<div className="mb-5 flex items-center justify-between">
				<div>
					<h3 className="text-lg font-medium">Photos</h3>
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						Photos from everyday life and travel.
					</p>
				</div>
				<Link
					href="/photos"
					className="font-base group relative inline-flex items-center gap-[1px] font-[450] text-zinc-900 dark:text-zinc-50"
				>
					View gallery
					<SvgArrowRight
						link="/photos"
						className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					/>
					<span className="absolute bottom-0.5 left-0 block h-[1px] w-full max-w-0 bg-zinc-900 transition-all duration-200 group-hover:max-w-full" />
				</Link>
			</div>
			{photos.length > 0 ? (
				<PhotoLightboxGrid
					photos={photos.map((photo, index) =>
						buildPhotoViewerItem({
							ref: photo.displayRef,
							photo,
							index,
						}),
					)}
					gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-4"
					thumbnailClassName="aspect-[4/5] w-full rounded-xl"
				/>
			) : (
				<p className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
					The gallery is being curated. You can still open the archive page.
				</p>
			)}
		</section>
	);
}
