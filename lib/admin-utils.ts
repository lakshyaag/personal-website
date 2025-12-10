/**
 * Shared utilities for admin pages
 */

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
	return new Date().toISOString().split("T")[0];
}

/**
 * Get current time in HH:MM format
 */
export function getCurrentTime(): string {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

/**
 * Format a date string (YYYY-MM-DD) to a human-readable format
 * Example: "2025-12-10" -> "Tue, Dec 10, 2025"
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
 * Format an ISO timestamp to a human-readable time
 * Example: "2025-12-10T14:30:00.000Z" -> "2:30 PM"
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
 * Extract time (HH:MM) from an ISO timestamp
 */
export function extractTime(isoString: string): string {
	const date = new Date(isoString);
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

/**
 * Combine a date (YYYY-MM-DD) and time (HH:MM) into an ISO timestamp
 */
export function combineDateAndTime(date: string, time: string): string {
	const [hours, minutes] = time.split(":");
	const dateTime = new Date(date);
	dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
	return dateTime.toISOString();
}
