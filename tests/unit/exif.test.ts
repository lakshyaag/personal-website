import { describe, expect, it } from "vitest";
import { exifDate, extractMetadata } from "../../shared/exif";

// Synthetic 8x6 JPEG: Canon EOS R6, 2024-06-01 18:30 +02:00, Sydney GPS. No real photo data.
const exifJpeg = Uint8Array.from(
	atob(
		"/9j/4QGcRXhpZgAASUkqAAgAAAAJAA8BAgAGAAAAkgAAABABAgAHAAAAigAAABIBAwABAAAAAQAAABoBBQABAAAAegAAABsBBQABAAAAggAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAmAAAACWIBAABAAAALgEAAAAAAAA4YwAA6AMAADhjAADoAwAARU9TIFI2AABDYW5vbgAJAACQBwAEAAAAMDIxMAOQAgAUAAAAGgEAABGQAgAHAAAAEgEAAAGRBwAEAAAAAQIDAACgBwAEAAAAMDEwMAGgAwABAAAA//8AAAKgBAABAAAACAAAAAOgBAABAAAABgAAADSkAgAIAAAACgEAAAAAAABSRiAzNW1tACswMjowMAAAMjAyNDowNjowMSAxODozMDowMAAEAAEAAgACAAAAUwAAAAIABQADAAAAfAEAAAMAAgACAAAARQAAAAQABQADAAAAZAEAAAAAAACXAAAAAQAAAAwAAAABAAAAJAAAAAEAAAAhAAAAAQAAADMAAAABAAAAAAAAAAEAAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAGAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMAVdf/9k=",
	),
	(c) => c.charCodeAt(0),
);

describe("EXIF extraction", () => {
	it("reads capture time with its offset, GPS and camera", async () => {
		const metadata = await extractMetadata(exifJpeg.buffer);
		expect(metadata.takenAt).toBe("2024-06-01T16:30:00.000Z");
		expect(metadata.latitude).toBeCloseTo(-33.85);
		expect(metadata.longitude).toBeCloseTo(151.21);
		expect(metadata.camera).toMatchObject({ make: "Canon", model: "EOS R6" });
	});
	it("keeps offset-less times as wall clock and ignores non-JPEG input", async () => {
		expect(exifDate("2025:12:03 20:13:59", undefined)).toBe(
			"2025-12-03T20:13:59.000Z",
		);
		expect(exifDate("garbage", "+01:00")).toBeNull();
		expect(await extractMetadata(new Uint8Array(4).buffer)).toEqual({
			takenAt: null,
			latitude: null,
			longitude: null,
			camera: null,
		});
	});
});
