"use client";

import {
	type JournalPhoto,
	MAX_PHOTOS,
	MAX_PHOTO_BYTES,
} from "@/shared/journal";
import { useEffect, useRef } from "react";
import { journalRequest } from "./client";

export interface DraftPhoto {
	id: string;
	photo?: JournalPhoto;
	file?: File;
	preview?: string;
	progress: number;
	uploading: boolean;
	error?: string;
	existing: boolean;
}
interface Props {
	entryId: string;
	photos: DraftPhoto[];
	onChange: React.Dispatch<React.SetStateAction<DraftPhoto[]>>;
	disabled: boolean;
}
export function photoIsReady(item: DraftPhoto) {
	return !item.uploading && !item.error && item.photo?.state === "ready";
}
export default function PhotoEditor({
	entryId,
	photos,
	onChange,
	disabled,
}: Props) {
	const uploads = useRef(new Map<string, XMLHttpRequest>());
	const previews = useRef(new Set<string>());
	const mounted = useRef(true);
	const photosRef = useRef(photos);
	photosRef.current = photos;
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
	useEffect(() => {
		const controller = new AbortController();
		let active = true;
		async function poll() {
			const pending = photosRef.current.filter(
				(item) =>
					item.photo && ["queued", "processing"].includes(item.photo.state),
			);
			await Promise.all(
				pending.map(async (item) => {
					try {
						const photo = await journalRequest<JournalPhoto>(
							`photos/${item.id}`,
							{ signal: controller.signal },
						);
						if (active)
							onChange((items) =>
								items.map((current) =>
									current.id === item.id
										? {
												...current,
												photo,
												error:
													photo.state === "failed"
														? (photo.error ?? "Processing failed")
														: undefined,
											}
										: current,
								),
							);
					} catch (error) {
						if (
							active &&
							!(error instanceof DOMException && error.name === "AbortError")
						)
							onChange((items) =>
								items.map((current) =>
									current.id === item.id
										? {
												...current,
												error: "Could not check processing. Retry.",
											}
										: current,
								),
							);
					}
				}),
			);
		}
		const timer = window.setInterval(() => void poll(), 2000);
		return () => {
			active = false;
			controller.abort();
			window.clearInterval(timer);
		};
	}, [onChange]);
	async function upload(item: DraftPhoto) {
		if (!item.file) return;
		update(item.id, { uploading: true, error: undefined, progress: 0 });
		try {
			const prepared = await journalRequest<{
				photo: JournalPhoto;
				uploadUrl: string | null;
				headers: Record<string, string>;
			}>("photos", {
				method: "POST",
				body: JSON.stringify({
					id: item.id,
					entryId,
					fileName: item.file.name,
					mimeType: item.file.type,
					byteSize: item.file.size,
				}),
			});
			if (!mounted.current) return;
			update(item.id, { photo: prepared.photo });
			const uploadUrl = prepared.uploadUrl;
			if (uploadUrl)
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					uploads.current.set(item.id, xhr);
					xhr.open("PUT", uploadUrl);
					xhr.timeout = 120_000;
					for (const [key, value] of Object.entries(prepared.headers))
						xhr.setRequestHeader(key, value);
					xhr.upload.onprogress = (event) => {
						if (event.lengthComputable)
							update(item.id, {
								progress: Math.round((event.loaded / event.total) * 100),
							});
					};
					xhr.onload = () => {
						uploads.current.delete(item.id);
						if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 412)
							resolve();
						else
							reject(
								new Error(
									`Upload failed (${xhr.status}). Check R2 CORS and retry.`,
								),
							);
					};
					xhr.onerror = () => {
						uploads.current.delete(item.id);
						reject(
							new Error("Upload failed. Check your connection and R2 CORS."),
						);
					};
					xhr.ontimeout = () => {
						uploads.current.delete(item.id);
						reject(new Error("Upload timed out. Retry."));
					};
					xhr.onabort = () => {
						uploads.current.delete(item.id);
						reject(new Error("Upload canceled"));
					};
					xhr.send(item.file);
				});
			if (!mounted.current) return;
			const photo = await journalRequest<JournalPhoto>(
				`photos/${item.id}/complete`,
				{ method: "POST" },
			);
			update(item.id, {
				photo,
				uploading: false,
				progress: 100,
				error:
					photo.state === "failed"
						? (photo.error ?? "Processing failed")
						: undefined,
			});
		} catch (error) {
			update(item.id, {
				uploading: false,
				error: error instanceof Error ? error.message : "Upload failed",
			});
		}
	}
	async function retry(item: DraftPhoto) {
		if (!item.photo || item.photo.state === "pending") {
			await upload(item);
			return;
		}
		update(item.id, { uploading: true, error: undefined });
		try {
			const photo = await journalRequest<JournalPhoto>(
				`photos/${item.id}/retry`,
				{ method: "POST" },
			);
			update(item.id, {
				photo,
				uploading: false,
				error:
					photo.state === "failed"
						? (photo.error ?? "Processing failed")
						: undefined,
			});
		} catch (error) {
			update(item.id, {
				uploading: false,
				error: error instanceof Error ? error.message : "Retry failed",
			});
		}
	}
	async function remove(item: DraftPhoto) {
		if (!item.existing && item.photo) {
			try {
				await journalRequest(`photos/${item.id}`, { method: "DELETE" });
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
		<section className="space-y-3" aria-label="Journal photos">
			<div className="flex items-center justify-between">
				<h3 className="font-medium">
					Photos{" "}
					<span className="text-sm text-zinc-500">
						{photos.length}/{MAX_PHOTOS}
					</span>
				</h3>
				<label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
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
			<p className="text-sm text-zinc-500">
				Private originals. JPEG, PNG, WebP, or AVIF · up to 20 MB and 40
				megapixels each. Save when processing is complete.
			</p>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{photos.map((item) => (
					<div
						key={item.id}
						data-testid="draft-photo"
						className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
					>
						{/* Private images must not go through Next.js' public image optimization cache. */}
						{(item.photo?.state === "ready" || item.preview) && (
							<img
								src={
									item.photo?.state === "ready"
										? `/api/migration/photos/${item.id}/display`
										: item.preview
								}
								alt={item.photo?.fileName ?? item.file?.name ?? "Journal photo"}
								className="aspect-square w-full object-cover"
							/>
						)}
						<div className="space-y-2 p-3">
							<p className="truncate text-sm">
								{item.photo?.fileName ?? item.file?.name}
							</p>
							<output className="block text-sm text-zinc-500">
								{item.uploading
									? `Uploading ${item.progress}%`
									: item.photo?.state === "ready"
										? "Ready · private"
										: (item.photo?.state ?? "Not uploaded")}
							</output>
							{item.error && (
								<p
									role="alert"
									className="text-sm text-red-600 dark:text-red-400"
								>
									{item.error}
								</p>
							)}
							<div className="flex gap-3 text-sm">
								{item.error && (
									<button
										type="button"
										className="underline"
										disabled={disabled || item.uploading}
										onClick={() => void retry(item)}
									>
										Retry photo
									</button>
								)}
								<button
									type="button"
									className="underline"
									disabled={disabled || item.uploading}
									onClick={() => void remove(item)}
								>
									Remove photo
								</button>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
