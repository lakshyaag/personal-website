import exifr from "exifr";
import type { Camera } from "./photos";

// Shared by the browser upload path and one-off import scripts.
export interface ExtractedMetadata {
	takenAt: string | null;
	latitude: number | null;
	longitude: number | null;
	camera: Camera | null;
}
/** "2025:12:03 20:13:59" + optional "-05:00" -> ISO instant. Without an offset, wall-clock time is kept as UTC. */
export function exifDate(value: unknown, offset: unknown) {
	if (typeof value !== "string") return null;
	const match = value.match(
		/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
	);
	if (!match) return null;
	const zone =
		typeof offset === "string" && /^[+-]\d{2}:\d{2}$/.test(offset)
			? offset
			: "Z";
	const date = new Date(
		`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${zone}`,
	);
	return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
function gpsDecimal(value: unknown, ref: unknown) {
	const parts = Array.isArray(value) ? value : [value];
	if (
		!parts.length ||
		!parts.every((part) => typeof part === "number" && Number.isFinite(part))
	)
		return null;
	const [degrees, minutes = 0, seconds = 0] = parts as number[];
	const decimal = degrees + minutes / 60 + seconds / 3600;
	return ref === "S" || ref === "W" ? -decimal : decimal;
}
/** Reads capture time, GPS and camera from the original before variants strip all metadata. */
export async function extractMetadata(
	bytes: ArrayBuffer,
): Promise<ExtractedMetadata> {
	const empty = {
		takenAt: null,
		latitude: null,
		longitude: null,
		camera: null,
	};
	const start = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
	// Camera EXIF is JPEG; exifr leaks unhandled rejections on formats it can't read.
	if (start[0] !== 0xff || start[1] !== 0xd8) return empty;
	let exif: Record<string, unknown> | undefined;
	try {
		// Raw values: revived dates would depend on the runtime's time zone.
		exif = await exifr.parse(bytes, {
			reviveValues: false,
			pick: [
				"DateTimeOriginal",
				"OffsetTimeOriginal",
				"CreateDate",
				"Make",
				"Model",
				"LensModel",
				"FNumber",
				"ExposureTime",
				"ISO",
				"GPSLatitude",
				"GPSLongitude",
				"GPSLatitudeRef",
				"GPSLongitudeRef",
			],
		});
	} catch {
		return empty;
	}
	if (!exif) return empty;
	const number = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value) ? value : null;
	const text = (value: unknown) =>
		typeof value === "string" && value.trim()
			? value.trim().slice(0, 100)
			: null;
	const latitude = gpsDecimal(exif.GPSLatitude, exif.GPSLatitudeRef);
	const longitude = gpsDecimal(exif.GPSLongitude, exif.GPSLongitudeRef);
	const hasGps =
		latitude !== null &&
		longitude !== null &&
		Math.abs(latitude) <= 90 &&
		Math.abs(longitude) <= 180;
	const camera = {
		make: text(exif.Make),
		model: text(exif.Model),
		lens: text(exif.LensModel),
		fNumber: number(exif.FNumber),
		exposureTime: number(exif.ExposureTime),
		iso: number(exif.ISO),
	};
	return {
		takenAt:
			exifDate(exif.DateTimeOriginal, exif.OffsetTimeOriginal) ??
			exifDate(exif.CreateDate, null),
		latitude: hasGps ? latitude : null,
		longitude: hasGps ? longitude : null,
		camera: Object.values(camera).some((value) => value !== null)
			? camera
			: null,
	};
}
