import { expect, test } from "@playwright/test";
import { BASE_URL } from "./env";
import { card, open, png, sheet, signIn } from "./helpers";

test("retains a successful upload when another file fails, then saves only the retained photo", async ({
	page,
	context,
}) => {
	await signIn(context);
	await open(page, "/admin/journal");
	await page.getByRole("button", { name: "New entry" }).click();
	await sheet(page)
		.getByLabel("Your thoughts")
		.fill("Browser test: partial upload");
	let uploads = 0;
	await page.route(
		/\/api\/admin\/photos\/[^/]+\/upload-original$/,
		async (route) => {
			uploads++;
			if (uploads === 2)
				await route.fulfill({ status: 503, body: "Simulated upload failure" });
			else await route.continue();
		},
	);
	const image = await png("#ebc27a");
	await sheet(page)
		.getByLabel("Add photos", { exact: true })
		.setInputFiles([
			{ name: "first.png", mimeType: "image/png", buffer: image },
			{ name: "second.png", mimeType: "image/png", buffer: image },
		]);
	await expect(page.getByText("Ready", { exact: true })).toBeVisible({
		timeout: 60_000,
	});
	await expect(page.getByText(/Upload failed \(503\)/)).toBeVisible();
	const save = sheet(page).getByRole("button", { name: "Save", exact: true });
	await expect(save).toBeDisabled();
	await page
		.getByTestId("draft-photo")
		.filter({ hasText: "Upload failed (503)" })
		.getByRole("button", { name: "Remove photo", exact: true })
		.click();
	await expect(page.getByTestId("draft-photo")).toHaveCount(1);
	await save.click();
	await expect(
		card(page, "Browser test: partial upload").getByRole("img"),
	).toHaveCount(1);
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
