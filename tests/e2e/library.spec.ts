import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { BASE_URL } from "./env";
import { open, sheet, signIn } from "./helpers";

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
		.getByLabel("Upload", { exact: true })
		.setInputFiles([
			{ name: "library-test.jpg", mimeType: "image/jpeg", buffer: image },
		]);
	await page.getByRole("button", { name: "Not used", exact: true }).click();
	const tile = page.getByRole("button", { name: "Edit library-test.jpg" });
	await expect(tile.first()).toBeVisible({ timeout: 60_000 });
	await tile.first().click();
	await sheet(page).getByLabel("Title").fill("Library browser test");
	await expect(
		sheet(page).getByText("Private: only you can see it."),
	).toBeVisible();
	// The photo's EXIF location and camera show in the editor.
	await expect(sheet(page).getByText("-33.85000, 151.21000")).toBeVisible();
	await expect(sheet(page).getByText("Canon EOS R6")).toBeVisible();
	await sheet(page).getByLabel("In the gallery").check();
	await expect(
		sheet(page).getByText("Public: shown on the gallery."),
	).toBeVisible();
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	await page.getByRole("button", { name: "Gallery", exact: true }).click();
	const published = page.getByRole("button", {
		name: "Edit Library browser test",
	});
	await expect(published).toBeVisible();
	await expect(published).toContainText("In gallery");

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

	// Select mode: take it out of the gallery (which makes it private), then delete it.
	await page.getByRole("button", { name: "All", exact: true }).click();
	await page.getByRole("button", { name: "Select", exact: true }).click();
	const pick = page.getByRole("button", {
		name: "Select Library browser test",
	});
	await pick.click();
	await expect(page.getByText("1 photo selected")).toBeVisible();
	await page.getByRole("button", { name: "Remove from gallery" }).click();
	await expect(
		page.getByText("1 photo removed from the gallery"),
	).toBeVisible();
	expect((await anonymous.request.get(display)).status()).toBe(404);
	await expect(
		page.getByRole("button", { name: "Edit Library browser test" }),
	).not.toContainText("In gallery");
	await page.getByRole("button", { name: "Select", exact: true }).click();
	await pick.click();
	const id = /photos\/([^/]+)\//.exec(display)?.[1];
	await page.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(page.getByText("1 photo deleted")).toBeVisible();
	await expect(page.getByText("1 photo deleted")).toHaveCount(0, {
		timeout: 15_000,
	});
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
