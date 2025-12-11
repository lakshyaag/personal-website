"use client";

import pluralize from "pluralize";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";

interface UseAdminCrudOptions<T> {
	/** API endpoint (e.g., "/api/journal") */
	endpoint: string;
	/** Human-readable entity name for messages (e.g., "entry", "log") */
	entityName: string;
	/** Optional plural form of the entity name (e.g., "entries") */
	entityNamePlural?: string;
	/** Use alert() instead of toast for notifications */
	useAlert?: boolean;
	/** Transform function before sending to API */
	transformForApi?: (item: T) => unknown;
}

interface UseAdminCrudReturn<T> {
	/** All items loaded from the API */
	items: T[];
	/** Whether data is currently being loaded */
	loading: boolean;
	/** Whether a save operation is in progress */
	saving: boolean;
	/** Load all items from the API (stores in items state, returns void) */
	loadAll: () => Promise<T[]>;
	/** Load items for a specific date */
	loadByDate: (date: string) => Promise<T[]>;
	/** Load items grouped by date */
	loadGrouped: () => Promise<Record<string, T[]>>;
	/** Load a single item by ID */
	loadById: (id: string) => Promise<T | null>;
	/** Save (create or update) an item */
	save: (item: T) => Promise<string | null>;
	/** Delete an item by ID (with confirmation) */
	remove: (id: string, skipConfirm?: boolean) => Promise<boolean>;
	/** Set items manually (useful for local state management) */
	setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Generic hook for CRUD operations on admin pages
 * Provides loading states, error handling, and toast notifications
 */
export function useAdminCrud<T extends { id?: string }>({
	endpoint,
	entityName,
	entityNamePlural,
	useAlert = false,
	transformForApi,
}: UseAdminCrudOptions<T>): UseAdminCrudReturn<T> {
	const [items, setItems] = useState<T[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const pluralEntityName = useMemo(
		() => entityNamePlural ?? pluralize(entityName),
		[entityName, entityNamePlural],
	);

	const notify = useCallback(
		(type: "success" | "error", message: string) => {
			if (useAlert) {
				alert(message);
			} else {
				type === "success" ? toast.success(message) : toast.error(message);
			}
		},
		[useAlert],
	);

	const loadAll = useCallback(async (): Promise<T[]> => {
		setLoading(true);
		try {
			const res = await fetch(endpoint);
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			setItems(data);
			return data;
		} catch (err) {
			console.error(`Failed to load ${pluralEntityName}:`, err);
			notify("error", `Failed to load ${pluralEntityName}`);
			return [];
		} finally {
			setLoading(false);
		}
	}, [endpoint, notify, pluralEntityName]);

	const loadByDate = useCallback(
		async (date: string): Promise<T[]> => {
			setLoading(true);
			try {
				const res = await fetch(`${endpoint}?date=${date}`);
				if (!res.ok) throw new Error("Failed to fetch");
				const data = await res.json();
				return data;
			} catch (err) {
				console.error(`Failed to load ${pluralEntityName} by date:`, err);
				notify("error", `Failed to load ${pluralEntityName}`);
				return [];
			} finally {
				setLoading(false);
			}
		},
		[endpoint, notify, pluralEntityName],
	);

	const loadGrouped = useCallback(async (): Promise<Record<string, T[]>> => {
		setLoading(true);
		try {
			const res = await fetch(`${endpoint}?grouped=true`);
			if (!res.ok) throw new Error("Failed to fetch");
			return await res.json();
		} catch (err) {
			console.error(`Failed to load grouped ${pluralEntityName}:`, err);
			notify("error", `Failed to load ${pluralEntityName}`);
			return {};
		} finally {
			setLoading(false);
		}
	}, [endpoint, notify, pluralEntityName]);

	const loadById = useCallback(
		async (id: string): Promise<T | null> => {
			try {
				const res = await fetch(`${endpoint}?id=${id}`);
				if (!res.ok) {
					if (res.status === 404) {
						notify("error", `${capitalize(entityName)} not found`);
						return null;
					}
					throw new Error("Failed to fetch");
				}
				return await res.json();
			} catch (err) {
				console.error(`Failed to load ${entityName}:`, err);
				notify("error", `Failed to load ${entityName}`);
				return null;
			}
		},
		[endpoint, entityName, notify],
	);

	const save = useCallback(
		async (item: T): Promise<string | null> => {
			setSaving(true);
			try {
				const body = transformForApi ? transformForApi(item) : item;
				const res = await fetch(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				if (!res.ok) throw new Error("Save failed");

				const result = await res.json();
				const isUpdate = !!item.id;
				notify(
					"success",
					isUpdate
						? `${capitalize(entityName)} updated successfully!`
						: `${capitalize(entityName)} saved successfully!`,
				);

				return result.id;
			} catch (err) {
				console.error(`Save ${entityName} error:`, err);
				notify("error", `Failed to save ${entityName}`);
				return null;
			} finally {
				setSaving(false);
			}
		},
		[endpoint, entityName, notify, transformForApi],
	);

	const remove = useCallback(
		async (id: string, skipConfirm = false): Promise<boolean> => {
			if (!skipConfirm) {
				const confirmed = window.confirm(
					`Are you sure you want to delete this ${entityName}?`,
				);
				if (!confirmed) return false;
			}

			try {
				const res = await fetch(`${endpoint}?id=${id}`, {
					method: "DELETE",
				});

				if (!res.ok) throw new Error("Delete failed");

				notify("success", `${capitalize(entityName)} deleted successfully!`);
				return true;
			} catch (err) {
				console.error(`Delete ${entityName} error:`, err);
				notify("error", `Failed to delete ${entityName}`);
				return false;
			}
		},
		[endpoint, entityName, notify],
	);

	return {
		items,
		loading,
		saving,
		loadAll,
		loadByDate,
		loadGrouped,
		loadById,
		save,
		remove,
		setItems,
	};
}

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

