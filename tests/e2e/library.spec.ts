import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { BASE_URL } from "./env";
import { deleteFromSheet, open, sheet, signIn } from "./helpers";

test("uploads to the library, publishes to the gallery, and serves it publicly only while public", async ({
	page,
	context,
	browser,
}) => {
	await signIn(context);
	await open(page, "/admin/photos");
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
	const tile = page.getByRole("button", { name: "Edit library-test.jpg" });
	await expect(tile.first()).toBeVisible({ timeout: 60_000 });
	await tile.first().click();
	await sheet(page).getByLabel("Title").fill("Library browser test");
	await sheet(page).getByLabel("Visibility").selectOption("public");
	await sheet(page).getByLabel("Show in gallery").check();
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	await page.getByRole("button", { name: "Gallery", exact: true }).click();
	const published = page.getByRole("button", {
		name: "Edit Library browser test",
	});
	await expect(published).toBeVisible();
	await expect(published).toContainText("Public");

	// The gallery page shows it right away (the save refreshed the public cache) without a session.
	const anonymous = await browser.newContext();
	const visitor = await anonymous.newPage();
	await visitor.goto(`${BASE_URL}/photos`);
	const thumb = await visitor
		.getByRole("img", { name: "Library browser test" })
		.first()
		.getAttribute("src");
	expect(thumb).toMatch(/\/public\/photos\/.+\/thumb$/);
	const display = (thumb ?? "").replace(/thumb$/, "display");
	const served = await anonymous.request.get(display);
	expect(served.status()).toBe(200);
	expect(served.headers()["cache-control"]).toContain("immutable");
	// Browser-made variants never carry the original's EXIF/GPS.
	expect((await served.body()).includes("Exif")).toBe(false);

	await published.click();
	await sheet(page).getByLabel("Visibility").selectOption("private");
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	await expect(published).not.toContainText("Public");
	expect((await anonymous.request.get(display)).status()).toBe(404);
	await published.click();
	const id = /photos\/([^/]+)\//.exec(display)?.[1];
	await deleteFromSheet(page, "Photo deleted");
	// The request goes out once the undo window passes; the Worker's cron removes the files.
	await expect
		.poll(async () => {
			const response = await context.request.get(
				`${BASE_URL}/api/admin/photos/${id}`,
			);
			return response.status() === 404 ? "gone" : (await response.json()).state;
		})
		.toMatch(/^(gone|deleting)$/);
	await anonymous.close();
});
