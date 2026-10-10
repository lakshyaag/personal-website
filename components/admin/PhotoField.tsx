"use client";

import {
	MAX_PHOTOS,
	MAX_PHOTO_BYTES,
	type Photo,
	type PhotoVariant,
} from "@/shared/photos";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { adminRequest } from "./client";
import { preparePhoto } from "./photo-variants";

type UploadFile = "original" | PhotoVariant;
interface PreparedUpload {
	photo: Photo;
	uploads: Record<UploadFile, { url: string; headers: Record<string, string> }>;
}

export interface DraftPhoto {
	id: string;
	photo?: Photo;
	file?: File;
	preview?: string;
	progress: number;
	uploading: boolean;
	error?: string;
	existing: boolean;
}
interface Props {
	photos: DraftPhoto[];
	onChange: React.Dispatch<React.SetStateAction<DraftPhoto[]>>;
	disabled: boolean;
	/**
	 * The library has its own upload button (a label for `inputId`) and no per-entry limit,
	 * so it hides this header.
	 */
	inputId?: string;
}
export function photoIsReady(item: DraftPhoto) {
	return !item.uploading && !item.error && item.photo?.state === "ready";
}
export default function PhotoField({
	photos,
	onChange,
	disabled,
	inputId,
}: Props) {
	const uploads = useRef(new Map<string, XMLHttpRequest>());
	const previews = useRef(new Set<string>());
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			for (const upload of uploads.current.values()) upload.abort();
			for (const preview of previews.current) URL.revokeObjectURL(preview);
		};
	}, []);
	// Revoke previews when a draft is discarded or saved, not only on unmount.
	useEffect(() => {
		const active = new Set(photos.map((item) => item.preview));
		for (const preview of previews.current)
			if (!active.has(preview)) {
				URL.revokeObjectURL(preview);
				previews.current.delete(preview);
			}
	}, [photos]);
	function update(id: string, patch: Partial<DraftPhoto>) {
		if (mounted.current)
			onChange((items) =>
				items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
			);
	}
	function put(
		id: string,
		target: PreparedUpload["uploads"][UploadFile],
		body: Blob,
		onProgress: (loaded: number) => void,
	) {
		return new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			uploads.current.set(id, xhr);
			xhr.open("PUT", target.url);
			xhr.timeout = 120_000;
			for (const [key, value] of Object.entries(target.headers))
				xhr.setRequestHeader(key, value);
			xhr.upload.onprogress = (event) => onProgress(event.loaded);
			const done = (error?: Error) => {
				uploads.current.delete(id);
				if (error) reject(error);
				else resolve();
			};
			// 412: an earlier attempt already stored this exact file.
			xhr.onload = () =>
				done(
					(xhr.status >= 200 && xhr.status < 300) || xhr.status === 412
						? undefined
						: new Error(
								`Upload failed (${xhr.status}). Check R2 CORS and retry.`,
							),
				);
			xhr.onerror = () =>
				done(new Error("Upload failed. Check your connection and R2 CORS."));
			xhr.ontimeout = () => done(new Error("Upload timed out. Retry."));
			xhr.onabort = () => done(new Error("Upload canceled"));
			xhr.send(body);
		});
	}
	async function upload(item: DraftPhoto) {
		const file = item.file;
		if (!file) return;
		update(item.id, { uploading: true, error: undefined, progress: 0 });
		try {
			const prepared = await preparePhoto(file);
			const prepare = await adminRequest<PreparedUpload>("photos", {
				method: "POST",
				body: JSON.stringify({
					id: item.id,
					fileName: file.name,
					mimeType: file.type,
					byteSize: file.size,
					display: {
						type: prepared.variants.display.type,
						size: prepared.variants.display.size,
					},
					thumb: {
						type: prepared.variants.thumb.type,
						size: prepared.variants.thumb.size,
					},
				}),
			});
			if (!mounted.current) return;
			update(item.id, { photo: prepare.photo });
			const bodies: [UploadFile, Blob][] = [
				["original", file],
				["display", prepared.variants.display],
				["thumb", prepared.variants.thumb],
			];
			const total = bodies.reduce((sum, [, body]) => sum + body.size, 0);
			let finished = 0;
			for (const [name, body] of bodies) {
				await put(item.id, prepare.uploads[name], body, (loaded) =>
					update(item.id, {
						progress: Math.round(((finished + loaded) / total) * 100),
					}),
				);
				finished += body.size;
				if (!mounted.current) return;
			}
			const photo = await adminRequest<Photo>(`photos/${item.id}/complete`, {
				method: "POST",
				body: JSON.stringify({
					width: prepared.width,
					height: prepared.height,
					...prepared.metadata,
				}),
			});
			update(item.id, { photo, uploading: false, progress: 100 });
		} catch (error) {
			update(item.id, {
				uploading: false,
				error: error instanceof Error ? error.message : "Upload failed",
			});
		}
	}
	async function remove(item: DraftPhoto) {
		if (!item.existing && item.photo) {
			try {
				await adminRequest(`photos/${item.id}`, { method: "DELETE" });
			} catch (error) {
				update(item.id, {
					error:
						error instanceof Error ? error.message : "Could not remove photo",
				});
				return;
			}
		}
		onChange((items) => items.filter((current) => current.id !== item.id));
	}
	function select(event: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []);
		event.target.value = "";
		const available = MAX_PHOTOS - photos.length;
		const additions = files.slice(0, available).map((file): DraftPhoto => {
			const valid =
				["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
					file.type,
				) &&
				file.size > 0 &&
				file.size <= MAX_PHOTO_BYTES;
			const preview = valid ? URL.createObjectURL(file) : undefined;
			if (preview) previews.current.add(preview);
			return {
				id: crypto.randomUUID(),
				file,
				preview,
				progress: 0,
				uploading: valid,
				existing: false,
				error: valid ? undefined : "Use JPEG, PNG, WebP, or AVIF up to 20 MB.",
			};
		});
		onChange((items) => [...items, ...additions]);
		for (const item of additions) if (!item.error) void upload(item);
	}
	return (
		<section className="space-y-2" aria-label="Photos">
			{inputId ? (
				<input
					id={inputId}
					className="sr-only"
					type="file"
					multiple
					accept="image/jpeg,image/png,image/webp,image/avif"
					disabled={disabled || photos.length >= MAX_PHOTOS}
					onChange={select}
				/>
			) : (
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
						Photos{" "}
						<span className="text-zinc-500">
							{photos.length}/{MAX_PHOTOS}
						</span>
					</h3>
					<label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium has-disabled:opacity-50 dark:border-zinc-700">
						<ImagePlus className="h-4 w-4" />
						Add photos
						<input
							className="sr-only"
							aria-label="Add photos"
							type="file"
							multiple
							accept="image/jpeg,image/png,image/webp,image/avif"
							disabled={disabled || photos.length >= MAX_PHOTOS}
							onChange={select}
						/>
					</label>
				</div>
			)}
			{photos.length > 0 && (
				<div className="grid grid-cols-3 gap-2">
					{photos.map((item) => (
						<div
							key={item.id}
							data-testid="draft-photo"
							className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
						>
							<div className="relative">
								{/* Private images must not go through Next.js' public image optimization cache. */}
								{item.photo?.state === "ready" || item.preview ? (
									<img
										src={
											item.photo?.state === "ready"
												? `/api/admin/photos/${item.id}/thumb`
												: item.preview
										}
										alt={item.photo?.fileName ?? item.file?.name ?? "Photo"}
										className="aspect-square w-full object-cover"
									/>
								) : (
									<div className="aspect-square w-full bg-zinc-100 dark:bg-zinc-900" />
								)}
								<button
									type="button"
									aria-label="Remove photo"
									disabled={disabled || item.uploading}
									onClick={() => void remove(item)}
									className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							<div className="space-y-1 p-1.5 text-xs">
								<output className="block text-zinc-500">
									{item.uploading
										? `Uploading ${item.progress}%`
										: item.photo?.state === "ready"
											? "Ready"
											: (item.photo?.state ?? "Not uploaded")}
								</output>
								{item.error && (
									<p role="alert" className="text-red-600 dark:text-red-400">
										{item.error}
									</p>
								)}
								{item.error && (
									<button
										type="button"
										className="underline"
										disabled={disabled || item.uploading}
										onClick={() => void upload(item)}
									>
										Retry photo
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
