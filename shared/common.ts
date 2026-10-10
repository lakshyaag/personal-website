import { z } from "zod";

export const idSchema = z.uuid();
export const dateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const date = new Date(`${value}T12:00:00Z`);
		return (
			!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
		);
	}, "Use a real calendar date");
export function localDate(now = new Date()) {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
