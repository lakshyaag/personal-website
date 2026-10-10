import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import sharp from "sharp";
import { AUTH_SECRET, BASE_URL, OWNER_ID } from "./env";

test("retains a successful upload when another file fails, then saves only the retained photo", async ({
	page,
	context,
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
	await page.goto("/admin/journal");
	await page.getByLabel("Your thoughts").fill("Browser test: partial upload");
	let uploads = 0;
	await page.route(/\/api\/admin\/photos\/[^/]+\/upload$/, async (route) => {
		uploads++;
		if (uploads === 2)
			await route.fulfill({ status: 503, body: "Simulated upload failure" });
		else await route.continue();
	});
	const image = await sharp({
		create: { width: 30, height: 20, channels: 3, background: "#ebc27a" },
	})
		.png()
		.toBuffer();
	await page.getByLabel("Add photos", { exact: true }).setInputFiles([
		{ name: "first.png", mimeType: "image/png", buffer: image },
		{ name: "second.png", mimeType: "image/png", buffer: image },
	]);
	await expect(page.getByText("Ready · private")).toBeVisible({
		timeout: 60_000,
	});
	await expect(page.getByText(/Upload failed \(503\)/)).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Save entry", exact: true }),
	).toBeDisabled();
	const failed = page
		.getByTestId("draft-photo")
		.filter({ hasText: "Upload failed (503)" });
	await failed
		.getByRole("button", { name: "Remove photo", exact: true })
		.click();
	await expect(page.getByText("Ready · private")).toBeVisible();
	await page.getByRole("button", { name: "Save entry", exact: true }).click();
	const card = page
		.getByTestId("journal-entry")
		.filter({ hasText: "Browser test: partial upload" });
	await expect(card.getByRole("img")).toHaveCount(1);
	const data = (await (
		await context.request.get(`${BASE_URL}/api/admin/journal?limit=50`)
	).json()) as { entries: { id: string; version: number; content: string }[] };
	for (const entry of data.entries)
		if (entry.content === "Browser test: partial upload")
			await context.request.delete(
				`${BASE_URL}/api/admin/journal/${entry.id}?expectedVersion=${entry.version}`,
				{ headers: { Origin: BASE_URL } },
			);
});
