const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	weekday: "short",
	year: "numeric",
	month: "short",
	day: "numeric",
};

const DEFAULT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
	hour: "numeric",
	minute: "2-digit",
	hour12: true,
};

export function getTodayDate(): string {
	return new Date().toISOString().split("T")[0];
}

export function getCurrentTime(): string {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function formatDate(
	dateStr: string,
	options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
): string {
	if (!dateStr) return "";
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-US", options);
}

export function formatTime(
	isoString: string,
	options: Intl.DateTimeFormatOptions = DEFAULT_TIME_OPTIONS,
): string {
	if (!isoString) return "";
	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleTimeString("en-US", options);
}

