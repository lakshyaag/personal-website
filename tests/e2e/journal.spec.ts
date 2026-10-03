import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import sharp from "sharp";
import { AUTH_SECRET, BASE_URL, OWNER_ID } from "./env";

async function signIn(context: BrowserContext, ownerId = OWNER_ID) {
	const name = "authjs.session-token";
	const value = await encode({
		token: { sub: ownerId, ownerId, name: "Journal browser test" },
		secret: AUTH_SECRET,
		salt: name,
		maxAge: 3600,
	});
	await context.addCookies([
		{ name, value, url: BASE_URL, httpOnly: true, sameSite: "Lax" },
	]);
}
async function ready(page: Page) {
	await page.goto("/admin/journal");
	await expect(page.getByLabel("Your thoughts")).toBeVisible();
	await expect(page.getByText("Loading entries…")).not.toBeVisible();
}
async function clearTestEntries(context: BrowserContext) {
	const response = await context.request.get(
		`${BASE_URL}/api/migration/journal?limit=50`,
	);
	if (!response.ok()) return;
	const data = (await response.json()) as {
		entries: { id: string; version: number; content: string }[];
	};
	for (const entry of data.entries)
		if (entry.content.startsWith("Browser test:"))
			await context.request.delete(
				`${BASE_URL}/api/migration/journal/${entry.id}?expectedVersion=${entry.version}`,
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
		(await context.request.get(`${BASE_URL}/api/migration/journal`)).status(),
	).toBe(401);
	expect(
		(
			await context.request.get(
				`${BASE_URL}/api/migration/photos/${crypto.randomUUID()}/display`,
			)
		).status(),
	).toBe(401);
	await signIn(context, "999999");
	expect(
		(await context.request.get(`${BASE_URL}/api/migration/journal`)).status(),
	).toBe(401);
});
test("creates, edits, filters and deletes a journal entry", async ({
	page,
	context,
}) => {
	await signIn(context);
	await ready(page);
	await page.getByLabel("Entry date", { exact: true }).fill("2026-04-16");
	await expect(page.getByLabel("Time zone", { exact: true })).toHaveCount(0);
	await page.getByLabel("Your thoughts").fill("Browser test: first thought");
	await page.getByRole("button", { name: "Save entry", exact: true }).click();
	const card = page
		.getByTestId("journal-entry")
		.filter({ hasText: "Browser test: first thought" });
	await expect(card).toBeVisible();
	await expect(card).toContainText("2026-04-16");
	await card.getByRole("button", { name: "Edit", exact: true }).click();
	await page.getByLabel("Your thoughts").fill("Browser test: updated thought");
	await page.getByRole("button", { name: "Update entry", exact: true }).click();
	const updated = page
		.getByTestId("journal-entry")
		.filter({ hasText: "Browser test: updated thought" });
	await expect(updated).toContainText("version 2");
	await page.getByLabel("Filter entries").selectOption("date");
	await page.getByLabel("Filter date").fill("2026-04-17");
	await expect(updated).not.toBeVisible();
	await page.getByLabel("Filter date").fill("2026-04-16");
	await expect(updated).toBeVisible();
	page.once("dialog", (dialog) => dialog.accept());
	await updated.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(updated).not.toBeVisible();
});
test("keeps a draft on a failed save and warns before discarding", async ({
	page,
	context,
}) => {
	await signIn(context);
	await ready(page);
	await page.getByLabel("Your thoughts").fill("Browser test: keep this draft");
	await page.route("**/api/migration/journal", async (route) => {
		if (route.request().method() === "POST")
			await route.fulfill({
				status: 502,
				contentType: "application/json",
				body: JSON.stringify({ error: "Temporary backend outage" }),
			});
		else await route.continue();
	});
	await page.getByRole("button", { name: "Save entry", exact: true }).click();
	await expect(
		page.getByRole("alert").filter({ hasText: "Temporary backend outage" }),
	).toBeVisible();
	await expect(page.getByLabel("Your thoughts")).toHaveValue(
		"Browser test: keep this draft",
	);
	page.once("dialog", (dialog) => dialog.dismiss());
	await page.getByRole("button", { name: "Discard draft" }).click();
	await expect(page.getByLabel("Your thoughts")).toHaveValue(
		"Browser test: keep this draft",
	);
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "Discard draft" }).click();
	await expect(page.getByLabel("Your thoughts")).toHaveValue("");
});
test("prevents an older date response from replacing the selected date", async ({
	page,
	context,
}) => {
	await signIn(context);
	await ready(page);
	await page.route("**/api/migration/journal?*", async (route) => {
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
	await page.getByLabel("Filter entries").selectOption("date");
	await page.getByLabel("Filter date").fill("2026-01-01");
	await page.getByLabel("Filter date").fill("2026-01-02");
	await expect(
		page.getByText("No entries yet for this date. Write your first one above."),
	).toBeVisible();
	await page.waitForTimeout(800);
	await expect(
		page.getByText("Stale response must not appear"),
	).not.toBeVisible();
});
test("uploads a real image, waits for Cloudflare processing and saves its private variant", async ({
	page,
	context,
}) => {
	await signIn(context);
	await ready(page);
	await page.getByLabel("Your thoughts").fill("Browser test: photo memory");
	const image = await sharp({
		create: { width: 40, height: 30, channels: 3, background: "#34a89b" },
	})
		.jpeg()
		.withExif({ IFD0: { Artist: "Private journal metadata" } })
		.toBuffer();
	expect((await sharp(image).metadata()).exif).toBeDefined();
	await page.getByLabel("Add photos", { exact: true }).setInputFiles({
		name: "memory.jpg",
		mimeType: "image/jpeg",
		buffer: image,
	});
	await expect(page.getByText("Ready · private")).toBeVisible({
		timeout: 60000,
	});
	await page.getByRole("button", { name: "Save entry", exact: true }).click();
	const card = page
		.getByTestId("journal-entry")
		.filter({ hasText: "Browser test: photo memory" });
	await expect(card).toBeVisible();
	const source = await card.getByRole("img").getAttribute("src");
	expect(source).toMatch(/^\/api\/migration\/photos\/.+\/display$/);
	const response = await context.request.get(BASE_URL + source);
	expect(response.status()).toBe(200);
	expect(response.headers()["cache-control"]).toBe("private, no-store");
	const metadata = await sharp(await response.body()).metadata();
	expect(metadata.format).toBe("webp");
	expect(metadata.exif).toBeUndefined();
	expect(metadata.xmp).toBeUndefined();
	await page.screenshot({
		path: "test-results/journal-ready.png",
		fullPage: true,
	});
});
