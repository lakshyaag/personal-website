import { type BrowserContext, type Page, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import sharp from "sharp";
import { AUTH_SECRET, BASE_URL, OWNER_ID } from "./env";

export async function signIn(context: BrowserContext, ownerId = OWNER_ID) {
	const name = "authjs.session-token";
	const value = await encode({
		token: { sub: ownerId, ownerId, name: "Browser test" },
		secret: AUTH_SECRET,
		salt: name,
		maxAge: 3600,
	});
	await context.addCookies([
		{ name, value, url: BASE_URL, httpOnly: true, sameSite: "Lax" },
	]);
}
/** Opens an admin page and waits for its list to load. */
export async function open(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByText("Loading…")).toHaveCount(0);
}
export const sheet = (page: Page) => page.getByRole("dialog");
export const card = (page: Page, text: string) =>
	page.getByRole("article").filter({ hasText: text });
export const png = (background: string) =>
	sharp({ create: { width: 40, height: 30, channels: 3, background } })
		.png()
		.toBuffer();
/** Deletes from the sheet, then waits for the undo window to pass so the request goes out. */
export async function deleteFromSheet(page: Page, toast: string) {
	await sheet(page)
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(page.getByText(toast)).toBeVisible();
	await expect(page.getByText(toast)).toHaveCount(0, { timeout: 15_000 });
}
