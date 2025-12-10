/**
 * Date utility functions for admin modules
 * Consolidates date formatting logic used across workouts, journal, food, etc.
 */

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
export function getTodayDate(): string {
	return new Date().toISOString().split("T")[0];
}

/**
 * Get current time in HH:MM format (24-hour, local timezone)
 */
export function getCurrentTime(): string {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

/**
 * Format a YYYY-MM-DD date string to a human-readable format
 * @example formatDate("2024-12-10") // "Mon, Dec 10, 2024"
 */
export function formatDate(dateStr: string): string {
	// Parse date string as local date (YYYY-MM-DD format)
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/**
 * Format an ISO timestamp string to a human-readable time
 * @example formatTime("2024-12-10T14:30:00Z") // "2:30 PM"
 */
export function formatTime(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

/**
 * Parse a date (YYYY-MM-DD) and time (HH:MM) into a Date object
 * @example parseDateAndTime("2024-12-10", "14:30") // Date object for Dec 10, 2024 at 2:30 PM
 */
export function parseDateAndTime(date: string, time: string): Date {
	const [year, month, day] = date.split("-").map(Number);
	const [hours, minutes] = time.split(":").map(Number);
	return new Date(year, month - 1, day, hours, minutes);
}
