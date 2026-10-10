import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import sharp from "sharp";
import { AUTH_SECRET, BASE_URL, OWNER_ID } from "./env";

test("uploads to the library, publishes to the gallery, and serves it publicly only while public", async ({
	page,
	context,
	browser,
}) => {
	const name = "authjs.session-token";
	const value = await encode({
		token: { sub: OWNER_ID, ownerId: OWNER_ID },
		secret: AUTH_SECRET,
		salt: name,
		maxAge: 3600,
	});
	await context.addCookies([
		{ name, value, url: BASE_URL, httpOnly: true, sameSite: "Lax" },
	]);
	await page.goto("/admin/photos");
	const image = await sharp({
		create: { width: 40, height: 30, channels: 3, background: "#3a7bd5" },
	})
		.jpeg()
		.withExif({
			IFD0: { Make: "Canon", Model: "EOS R6" },
			IFD3: {
				GPSLatitudeRef: "S",
				GPSLatitude: "33/1 51/1 0/1",
				GPSLongitudeRef: "E",
				GPSLongitude: "151/1 12/1 36/1",
			},
		})
		.toBuffer();
	await page
		.getByLabel("Add photos", { exact: true })
		.setInputFiles([
			{ name: "library-test.jpg", mimeType: "image/jpeg", buffer: image },
		]);
	await page.getByRole("button", { name: "Unused", exact: true }).click();
	const tile = page.getByRole("button").filter({ hasText: "Private · Unused" });
	await expect(tile.first()).toBeVisible({ timeout: 60_000 });
	await tile.first().click();
	await page.getByLabel("Title").fill("Library browser test");
	await page.getByLabel("Visibility").selectOption("public");
	await page.getByLabel("Show in gallery").check();
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await page.getByRole("button", { name: "Gallery", exact: true }).click();
	const published = page
		.getByRole("button")
		.filter({ hasText: "Library browser test" });
	await expect(published).toBeVisible();

	// The public feed and image work without any session.
	const anonymous = await browser.newContext();
	const gallery = (await (
		await anonymous.request.get(`${BASE_URL}/api/photos`)
	).json()) as { id: string; title: string; displayRef: string }[];
	const item = gallery.find((photo) => photo.title === "Library browser test");
	expect(item?.displayRef).toMatch(/\/public\/photos\/.+\/display$/);
	const served = await anonymous.request.get(item?.displayRef ?? "");
	expect(served.status()).toBe(200);
	expect(served.headers()["cache-control"]).toContain("immutable");
	// Browser-made variants never carry the original's EXIF/GPS.
	expect((await served.body()).includes("Exif")).toBe(false);

	await published.click();
	await page.getByLabel("Visibility").selectOption("private");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(published).toContainText("Private");
	expect((await anonymous.request.get(item?.displayRef ?? "")).status()).toBe(
		404,
	);
	await published.click();
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(published).not.toBeVisible();
	await anonymous.close();
});
