import { type BrowserContext, expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import sharp from "sharp";
import { AUTH_SECRET, BASE_URL, OWNER_ID } from "./env";

async function signIn(context: BrowserContext) {
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
}
const accept = (page: import("@playwright/test").Page) =>
	page.once("dialog", (dialog) => dialog.accept());

test("migrated admin APIs reject anonymous visitors", async ({ context }) => {
	for (const path of [
		"food",
		"workouts",
		"workouts/stats",
		"visits",
		"books",
		"recommendations",
	])
		expect(
			(await context.request.get(`${BASE_URL}/api/admin/${path}`)).status(),
		).toBe(401);
});

test("logs food with a photo, edits it and deletes it", async ({
	page,
	context,
}) => {
	await signIn(context);
	await page.goto("/admin/food");
	await expect(page.getByText("Loading...")).not.toBeVisible();
	await page.getByLabel("Description").fill("Browser test: avocado toast");
	const image = await sharp({
		create: { width: 40, height: 30, channels: 3, background: "#7ab55c" },
	})
		.png()
		.toBuffer();
	await page
		.getByLabel("Add photos", { exact: true })
		.setInputFiles([
			{ name: "meal.png", mimeType: "image/png", buffer: image },
		]);
	await expect(page.getByText("Ready", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await page.getByRole("button", { name: "Save Entry" }).click();
	const card = page
		.locator("div.rounded-lg")
		.filter({ hasText: "Browser test: avocado toast" })
		.last();
	await expect(card).toBeVisible();
	await expect(card.getByRole("img").first()).toBeVisible();
	await card.getByRole("button", { name: "Edit", exact: true }).click();
	await page.getByLabel("Description").fill("Browser test: two eggs");
	await page.getByRole("button", { name: "Update Entry" }).click();
	const edited = page
		.locator("div.rounded-lg")
		.filter({ hasText: "Browser test: two eggs" })
		.last();
	await expect(edited).toBeVisible();
	accept(page);
	await edited.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(edited).not.toBeVisible();
});

test("logs a workout and loads the stats dashboard", async ({
	page,
	context,
}) => {
	await signIn(context);
	await page.goto("/admin/workouts");
	await page.getByLabel("Bodyweight (kg)").fill("79.2");
	await page.getByLabel("Notes (optional)").fill("Browser test: squats 3x5");
	await page.getByRole("button", { name: "Save Log" }).click();
	const card = page
		.locator("div.rounded-lg")
		.filter({ hasText: "Browser test: squats 3x5" })
		.last();
	await expect(card).toContainText("79.2 kg");
	await page.goto("/admin/workouts/dashboard");
	await expect(page.getByText("Loading stats...")).not.toBeVisible();
	await page.goto("/admin/workouts");
	accept(page);
	await page
		.locator("div.rounded-lg")
		.filter({ hasText: "Browser test: squats 3x5" })
		.last()
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(page.getByText("Browser test: squats 3x5")).not.toBeVisible();
});

test("saves a layover visit that shows on the public airports API", async ({
	page,
	context,
}) => {
	await signIn(context);
	await page.goto("/admin/airports");
	await page.getByLabel("Search Airport").fill("KJFK");
	await page.getByRole("button", { name: /^KJFK/ }).click();
	await page.getByLabel("Visit Date").fill("2026-01-02");
	await page.getByLabel("Layover").check();
	await page.getByLabel("Arrival Flight").fill("THY 717");
	await page.getByLabel("Departure Flight").fill("THY 35");
	await page.getByLabel("Notes (optional)").fill("Browser test: layover");
	await page.getByRole("button", { name: "Save Visit" }).click();
	await expect(page.getByText("Flights: THY 717 → THY 35")).toBeVisible();
	const visits = (await (
		await context.request.get(`${BASE_URL}/api/visits`)
	).json()) as { id: string; notes?: string; flightNumbers?: string[] }[];
	const visit = visits.find((v) => v.notes === "Browser test: layover");
	expect(visit?.flightNumbers).toEqual(["THY 717", "THY 35"]);
	accept(page);
	await page
		.locator("div.rounded-lg")
		.filter({ hasText: "Browser test: layover" })
		.last()
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(page.getByText("Browser test: layover")).not.toBeVisible();
});

test("adds a book and turns a public recommendation into one", async ({
	page,
	context,
}) => {
	const submitted = await context.request.post(`${BASE_URL}/api/recommend`, {
		data: { bookName: "Browser test: Dune", recommenderName: "Sam" },
	});
	expect(submitted.status()).toBe(200);
	await signIn(context);
	await page.goto("/admin/books");
	await expect(page.getByText("Browser test: Dune")).toBeVisible();
	await page.getByRole("button", { name: "Add to library" }).first().click();
	await expect(page.getByLabel("Title")).toHaveValue("Browser test: Dune");
	await page.getByLabel("Author").fill("Frank Herbert");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await expect(page.getByText("Book saved")).toBeVisible();
	const books = (await (
		await context.request.get(`${BASE_URL}/api/books`)
	).json()) as { id: string; title: string; status: string }[];
	const book = books.find((b) => b.title === "Browser test: Dune");
	expect(book?.status).toBe("want-to-read");
	// Accepting removed the recommendation.
	const recommendations = (await (
		await context.request.get(`${BASE_URL}/api/recommend`)
	).json()) as { bookName: string }[];
	expect(recommendations.some((r) => r.bookName === "Browser test: Dune")).toBe(
		false,
	);
	if (book)
		await context.request.delete(`${BASE_URL}/api/admin/books/${book.id}`, {
			headers: { Origin: BASE_URL },
		});
});
