import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import { localWorkerUploads } from "@/lib/backend/config";
import { photoUploadUrls } from "@/lib/backend/r2";
import { BackendError, workerJson } from "@/lib/backend/worker";
import {
	photoListSchema,
	photoSchema,
	uploadPhotoSchema,
} from "@/shared/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const filters = [
	"cursor",
	"limit",
	"visibility",
	"featured",
	"context",
	"unused",
];
export function GET(request: Request) {
	return privateRoute(request, async () => {
		const source = new URL(request.url);
		const query = new URLSearchParams();
		for (const key of filters) {
			const value = source.searchParams.get(key);
			if (value) query.set(key, value);
		}
		return privateJson(
			photoListSchema.parse(await workerJson(`/v1/photos?${query}`)),
		);
	});
}
export function POST(request: Request) {
	return privateRoute(request, async () => {
		const input = uploadPhotoSchema.parse(await readJson(request));
		const { display, thumb, ...original } = input;
		const photo = photoSchema.parse(
			await workerJson("/v1/photos", {
				method: "POST",
				body: JSON.stringify(original),
			}),
		);
		if (photo.state !== "pending")
			throw new BackendError(409, "Photo already uploaded", "CONFLICT");
		const uploads = localWorkerUploads()
			? Object.fromEntries(
					(
						[
							["original", photo.mimeType],
							["display", display.type],
							["thumb", thumb.type],
						] as const
					).map(([name, type]) => [
						name,
						{
							url: `/api/admin/photos/${photo.id}/upload-${name}`,
							headers: { "Content-Type": type },
						},
					]),
				)
			: await photoUploadUrls(photo, input);
		return privateJson({ photo, uploads }, 201);
	});
}
