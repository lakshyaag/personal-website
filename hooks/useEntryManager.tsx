import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface BaseEntry {
	id: string;
	date: string;
	photos?: string[];
}

export interface UseEntryManagerConfig<T extends BaseEntry> {
	resourceName: string; // e.g., "workouts", "food", "journal"
	apiEndpoint: string; // e.g., "/api/workouts"
	defaultEntry: () => T; // Factory function for new entries
}

export interface UseEntryManagerReturn<T extends BaseEntry> {
	// State
	entries: T[];
	loading: boolean;
	saving: boolean;
	editingEntry: T | null;

	// CRUD operations
	loadEntries: (params?: { date?: string; grouped?: boolean }) => Promise<void>;
	loadEntryById: (id: string) => Promise<T | null>;
	saveEntry: (entry: T) => Promise<string>;
	deleteEntry: (id: string) => Promise<void>;

	// Edit state management
	startEditing: (entry: T) => void;
	cancelEditing: () => void;
}

export function useEntryManager<T extends BaseEntry>(
	config: UseEntryManagerConfig<T>,
): UseEntryManagerReturn<T> {
	const { resourceName, apiEndpoint, defaultEntry } = config;

	const [entries, setEntries] = useState<T[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [editingEntry, setEditingEntry] = useState<T | null>(null);

	const loadEntries = useCallback(
		async (params?: { date?: string; grouped?: boolean }) => {
			setLoading(true);
			try {
				const searchParams = new URLSearchParams();
				if (params?.date) searchParams.set("date", params.date);
				if (params?.grouped) searchParams.set("grouped", "true");

				const url = `${apiEndpoint}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
				const res = await fetch(url);

				if (!res.ok) throw new Error(`Failed to fetch ${resourceName}`);

				const data = await res.json();
				setEntries(data);
			} catch (err) {
				console.error(`Failed to load ${resourceName}:`, err);
				toast.error(`Failed to load ${resourceName}`);
			} finally {
				setLoading(false);
			}
		},
		[apiEndpoint, resourceName],
	);

	const loadEntryById = useCallback(
		async (id: string): Promise<T | null> => {
			try {
				const res = await fetch(`${apiEndpoint}?id=${id}`);
				if (!res.ok) {
					if (res.status === 404) {
						toast.error("Entry not found");
						return null;
					}
					throw new Error("Failed to load entry");
				}
				const entry = await res.json();
				return entry as T;
			} catch (err) {
				console.error("Failed to load entry:", err);
				toast.error("Failed to load entry");
				return null;
			}
		},
		[apiEndpoint],
	);

	const saveEntry = useCallback(
		async (entry: T): Promise<string> => {
			setSaving(true);
			try {
				const res = await fetch(apiEndpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(entry),
				});

				if (!res.ok) throw new Error("Save failed");

				const { id } = await res.json();

				toast.success(
					editingEntry
						? `${resourceName} updated successfully!`
						: `${resourceName} saved successfully!`,
				);

				return id;
			} catch (err) {
				console.error("Save error:", err);
				toast.error(`Failed to save ${resourceName}`);
				throw err;
			} finally {
				setSaving(false);
			}
		},
		[apiEndpoint, resourceName, editingEntry],
	);

	const deleteEntry = useCallback(
		async (id: string) => {
			if (!confirm(`Are you sure you want to delete this ${resourceName}?`))
				return;

			try {
				const res = await fetch(`${apiEndpoint}?id=${id}`, {
					method: "DELETE",
				});

				if (!res.ok) throw new Error("Delete failed");

				toast.success(`${resourceName} deleted successfully!`);
			} catch (err) {
				console.error("Delete error:", err);
				toast.error(`Failed to delete ${resourceName}`);
				throw err;
			}
		},
		[apiEndpoint, resourceName],
	);

	const startEditing = useCallback((entry: T) => {
		setEditingEntry(entry);
	}, []);

	const cancelEditing = useCallback(() => {
		setEditingEntry(null);
	}, []);

	return {
		entries,
		loading,
		saving,
		editingEntry,
		loadEntries,
		loadEntryById,
		saveEntry,
		deleteEntry,
		startEditing,
		cancelEditing,
	};
}
