import { type BrowserContext, expect, test } from "@playwright/test";
import sharp from "sharp";
import { BASE_URL } from "./env";
import { card, deleteFromSheet, open, sheet, signIn } from "./helpers";

async function clearTestEntries(context: BrowserContext) {
	const response = await context.request.get(
		`${BASE_URL}/api/admin/journal?limit=50`,
	);
	if (!response.ok()) return;
	const data = (await response.json()) as {
		entries: { id: string; version: number; content: string }[];
	};
	for (const entry of data.entries)
		if (entry.content.startsWith("Browser test:"))
			await context.request.delete(
				`${BASE_URL}/api/admin/journal/${entry.id}?expectedVersion=${entry.version}`,
				{ headers: { Origin: BASE_URL } },
			);
}
test.afterEach(async ({ context }) => {
	await clearTestEntries(context);
});
test("anonymous and wrong-owner access is rejected without a private image leak", async ({
	page,
	context,
}) => {
	await page.goto("/admin/journal");
	await expect(page).toHaveURL(/\/admin\/login/);
	expect(
		(await context.request.get(`${BASE_URL}/api/admin/journal`)).status(),
	).toBe(401);
	expect(
		(
			await context.request.get(
				`${BASE_URL}/api/admin/photos/${crypto.randomUUID()}/display`,
			)
		).status(),
	).toBe(401);
	await signIn(context, "999999");
	expect(
		(await context.request.get(`${BASE_URL}/api/admin/journal`)).status(),
	).toBe(401);
});
test("creates, edits, filters, deletes with undo, then deletes a journal entry", async ({
	page,
	context,
}) => {
	await signIn(context);
	await open(page, "/admin/journal");
	await page.getByRole("button", { name: "New entry" }).click();
	await sheet(page).getByLabel("Entry date").fill("2026-04-16");
	await sheet(page)
		.getByLabel("Your thoughts")
		.fill("Browser test: first thought");
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
	const first = card(page, "Browser test: first thought");
	await expect(first.locator("time")).toHaveAttribute("datetime", "2026-04-16");
	await first.getByRole("button", { name: /^Edit entry/ }).click();
	await sheet(page)
		.getByLabel("Your thoughts")
		.fill("Browser test: updated thought");
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	const updated = card(page, "Browser test: updated thought");
	await expect(updated).toBeVisible();

	await page.getByRole("button", { name: "Day", exact: true }).click();
	await page.getByLabel("Day", { exact: true }).fill("2026-04-17");
	await expect(updated).toHaveCount(0);
	await page.getByLabel("Day", { exact: true }).fill("2026-04-16");
	await expect(updated).toBeVisible();

	// Undo brings it back and nothing is deleted.
	await updated.getByRole("button", { name: /^Edit entry/ }).click();
	await sheet(page)
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(updated).toHaveCount(0);
	await page.getByRole("button", { name: "Undo" }).click();
	await expect(updated).toBeVisible();

	await updated.getByRole("button", { name: /^Edit entry/ }).click();
	await deleteFromSheet(page, "Entry deleted");
	// The request goes out once the undo window passes.
	await expect
		.poll(async () => {
			const { entries } = (await (
				await context.request.get(
					`${BASE_URL}/api/admin/journal?date=2026-04-16`,
				)
			).json()) as { entries: { content: string }[] };
			return entries.some((e) => e.content.startsWith("Browser test:"));
		})
		.toBe(false);
});
test("keeps a draft on a failed save and asks before discarding it", async ({
	page,
	context,
}) => {
	await signIn(context);
	await open(page, "/admin/journal");
	await page.getByRole("button", { name: "New entry" }).click();
	await sheet(page)
		.getByLabel("Your thoughts")
		.fill("Browser test: keep this draft");
	await page.route("**/api/admin/journal", async (route) => {
		if (route.request().method() === "POST")
			await route.fulfill({
				status: 502,
				contentType: "application/json",
				body: JSON.stringify({ error: "Temporary backend outage" }),
			});
		else await route.continue();
	});
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		sheet(page)
			.getByRole("alert")
			.filter({ hasText: "Temporary backend outage" }),
	).toBeVisible();
	await expect(sheet(page).getByLabel("Your thoughts")).toHaveValue(
		"Browser test: keep this draft",
	);
	page.once("dialog", (dialog) => dialog.dismiss());
	await sheet(page).getByRole("button", { name: "Close" }).click();
	await expect(sheet(page).getByLabel("Your thoughts")).toHaveValue(
		"Browser test: keep this draft",
	);
	page.once("dialog", (dialog) => dialog.accept());
	await sheet(page).getByRole("button", { name: "Close" }).click();
	await expect(sheet(page)).toHaveCount(0);
});
test("prevents an older date response from replacing the selected date", async ({
	page,
	context,
}) => {
	await signIn(context);
	await open(page, "/admin/journal");
	await page.route("**/api/admin/journal?*", async (route) => {
		const date = new URL(route.request().url()).searchParams.get("date");
		if (date === "2026-01-01") {
			await new Promise((resolve) => setTimeout(resolve, 600));
			await route
				.fulfill({
					status: 500,
					contentType: "application/json",
					body: JSON.stringify({ error: "Stale response must not appear" }),
				})
				.catch(() => undefined);
		} else await route.continue();
	});
	await page.getByRole("button", { name: "Day", exact: true }).click();
	await page.getByLabel("Day", { exact: true }).fill("2026-01-01");
	await page.getByLabel("Day", { exact: true }).fill("2026-01-02");
	await expect(page.getByText("No entries on Fri, Jan 2, 2026.")).toBeVisible();
	await page.waitForTimeout(800);
	await expect(page.getByText("Stale response must not appear")).toHaveCount(0);
});
test("uploads a real image, waits for Cloudflare processing and saves its private variants", async ({
	page,
	context,
}) => {
	await signIn(context);
	await open(page, "/admin/journal");
	await page.getByRole("button", { name: "New entry" }).click();
	await sheet(page)
		.getByLabel("Your thoughts")
		.fill("Browser test: photo memory");
	const image = await sharp({
		create: { width: 40, height: 30, channels: 3, background: "#34a89b" },
	})
		.jpeg()
		.withExif({ IFD0: { Artist: "Private journal metadata" } })
		.toBuffer();
	expect((await sharp(image).metadata()).exif).toBeDefined();
	await sheet(page).getByLabel("Add photos", { exact: true }).setInputFiles({
		name: "memory.jpg",
		mimeType: "image/jpeg",
		buffer: image,
	});
	await expect(sheet(page).getByText("Ready", { exact: true })).toBeVisible({
		timeout: 60000,
	});
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	const entry = card(page, "Browser test: photo memory");
	await expect(entry).toBeVisible();
	const thumb = await entry.getByRole("img").first().getAttribute("src");
	expect(thumb).toMatch(/^\/api\/admin\/photos\/.+\/thumb$/);
	for (const source of [
		thumb ?? "",
		(thumb ?? "").replace(/thumb$/, "display"),
	]) {
		const response = await context.request.get(BASE_URL + source);
		expect(response.status()).toBe(200);
		expect(response.headers()["cache-control"]).toBe("private, no-store");
		const metadata = await sharp(await response.body()).metadata();
		expect(metadata.format).toBe("webp");
		expect(metadata.exif).toBeUndefined();
		expect(metadata.xmp).toBeUndefined();
	}
});
