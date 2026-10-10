import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import { localWorkerUploads } from "@/lib/backend/config";
import { photoUploadUrl } from "@/lib/backend/r2";
import { workerJson } from "@/lib/backend/worker";
import {
	createPhotoSchema,
	photoListSchema,
	photoSchema,
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
		const input = createPhotoSchema.parse(await readJson(request));
		const photo = photoSchema.parse(
			await workerJson("/v1/photos", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		);
		const uploadUrl =
			photo.state === "pending"
				? localWorkerUploads()
					? `/api/admin/photos/${photo.id}/upload`
					: await photoUploadUrl(photo)
				: null;
		return privateJson(
			{
				photo,
				uploadUrl,
				headers: { "Content-Type": photo.mimeType, "If-None-Match": "*" },
			},
			201,
		);
	});
}
