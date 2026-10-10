import { devices, expect, test } from "@playwright/test";
import { BASE_URL } from "./env";
import { card, deleteFromSheet, open, png, sheet, signIn } from "./helpers";

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

// A phone viewport and touch, in the same Chromium the other tests use.
const { defaultBrowserType: _, ...phone } = devices["Pixel 7"];
test.describe("on a phone", () => {
	test.use(phone);
	test("the tab bar and More menu reach every section", async ({
		page,
		context,
	}) => {
		await signIn(context);
		await page.goto("/admin");
		await expect(page).toHaveURL(/\/admin\/journal$/);
		const tabs = page.getByRole("navigation", { name: "Admin" });
		await tabs.getByRole("link", { name: "Food" }).click();
		await expect(page.getByRole("heading", { name: "Food" })).toBeVisible();
		await tabs.getByRole("button", { name: "More" }).click();
		await sheet(page).getByRole("link", { name: "Books" }).click();
		await expect(page.getByRole("heading", { name: "Books" })).toBeVisible();
		await expect(tabs.getByRole("button", { name: "More" })).toBeVisible();
		// Nothing overflows sideways.
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
	});
});

test("logs food with a photo, edits it and deletes it", async ({
	page,
	context,
}) => {
	await signIn(context);
	await open(page, "/admin/food");
	await page.getByRole("button", { name: "Log food" }).click();
	await sheet(page)
		.getByLabel("Description")
		.fill("Browser test: avocado toast");
	await sheet(page)
		.getByLabel("Add photos", { exact: true })
		.setInputFiles([
			{ name: "meal.png", mimeType: "image/png", buffer: await png("#7ab55c") },
		]);
	await expect(sheet(page).getByText("Ready", { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	const meal = card(page, "Browser test: avocado toast");
	await expect(meal.getByRole("img").first()).toBeVisible();
	await meal.getByRole("button", { name: /^Edit/ }).click();
	await sheet(page).getByLabel("Description").fill("Browser test: two eggs");
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	const edited = card(page, "Browser test: two eggs");
	await expect(edited).toBeVisible();
	await edited.getByRole("button", { name: /^Edit/ }).click();
	await deleteFromSheet(page, "Food entry deleted");
	await page.reload();
	await expect(edited).toHaveCount(0);
});

test("logs a workout and loads the stats dashboard", async ({
	page,
	context,
}) => {
	await signIn(context);
	await open(page, "/admin/workouts");
	await page.getByRole("button", { name: "Log workout" }).click();
	await sheet(page).getByLabel("Bodyweight (kg)").fill("79.2");
	await sheet(page).getByLabel("Workout").fill("Browser test: squats 3x5");
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	const log = card(page, "Browser test: squats 3x5");
	await expect(log).toContainText("79.2 kg");
	await page.getByRole("link", { name: "Stats" }).click();
	await expect(
		page.getByRole("heading", { name: "Workout stats" }),
	).toBeVisible();
	await expect(page.getByText("Loading…")).toHaveCount(0);
	await expect(
		page.getByRole("heading", { name: "Consistency" }),
	).toBeVisible();
	await page.getByRole("link", { name: "Logs" }).click();
	await log.getByRole("button", { name: /^Edit/ }).click();
	await deleteFromSheet(page, "Workout deleted");
	await page.reload();
	await expect(log).toHaveCount(0);
});

test("saves a layover visit that shows on the public airports page", async ({
	page,
	context,
	browser,
}) => {
	await signIn(context);
	await open(page, "/admin/airports");
	await page.getByRole("button", { name: "Add visit" }).click();
	const form = sheet(page);
	await form.getByLabel("Search Airport").fill("KJFK");
	await form.getByRole("button", { name: /^KJFK/ }).click();
	await form.getByLabel("Visit Date").fill("2026-01-02");
	await form.getByLabel("Layover").check();
	await form.getByLabel("Arrival Flight").fill("THY 717");
	await form.getByLabel("Departure Flight").fill("THY 35");
	await form.getByLabel("Notes (optional)").fill("Browser test: layover");
	await form.getByRole("button", { name: "Save", exact: true }).click();
	const visit = card(page, "Browser test: layover");
	await expect(visit).toContainText("Flights: THY 717 → THY 35");
	// The public page is rendered on the server and refreshed by the save.
	const anonymous = await browser.newContext();
	const html = await (
		await anonymous.request.get(`${BASE_URL}/airports`)
	).text();
	expect(html).toContain("Browser test: layover");
	expect(html).toContain("THY 717");
	await anonymous.close();
	await visit.getByRole("button", { name: /^Edit/ }).click();
	await deleteFromSheet(page, "Visit deleted");
	await page.reload();
	await expect(visit).toHaveCount(0);
});

test("adds a book and turns a public recommendation into one", async ({
	page,
	context,
	browser,
}) => {
	const submitted = await context.request.post(`${BASE_URL}/api/recommend`, {
		data: { bookName: "Browser test: Dune", recommenderName: "Sam" },
	});
	expect(submitted.status()).toBe(200);
	await signIn(context);
	await open(page, "/admin/books");
	await page.getByRole("button", { name: /^Requests/ }).click();
	const request = card(page, "Browser test: Dune");
	await request.getByRole("button", { name: "Add to library" }).click();
	await expect(sheet(page).getByLabel("Title")).toHaveValue(
		"Browser test: Dune",
	);
	await sheet(page).getByLabel("Author").fill("Frank Herbert");
	await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByText("Book saved")).toBeVisible();
	await expect(card(page, "Browser test: Dune")).toContainText("Want");
	const books = (await (
		await context.request.get(`${BASE_URL}/api/admin/books`)
	).json()) as { books: { id: string; title: string; status: string }[] };
	const book = books.books.find((b) => b.title === "Browser test: Dune");
	expect(book?.status).toBe("want-to-read");
	// Accepting removed the recommendation.
	const recommendations = (await (
		await context.request.get(`${BASE_URL}/api/admin/recommendations`)
	).json()) as { recommendations: { bookName: string }[] };
	expect(
		recommendations.recommendations.some(
			(r) => r.bookName === "Browser test: Dune",
		),
	).toBe(false);
	const anonymous = await browser.newContext();
	expect(
		await (await anonymous.request.get(`${BASE_URL}/bookshelf`)).text(),
	).toContain("Browser test: Dune");
	await anonymous.close();
	if (book)
		await context.request.delete(`${BASE_URL}/api/admin/books/${book.id}`, {
			headers: { Origin: BASE_URL },
		});
});
