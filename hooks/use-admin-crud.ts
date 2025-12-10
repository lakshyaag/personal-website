/**
 * Generic CRUD hook for admin modules
 * Consolidates state management and API operations across all admin modules
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/api-utils";
import type { CrudConfig } from "@/lib/admin-types";

type GetQuery = () => string | null | undefined;

export function useAdminCrud<T extends { id: string }>(
	config: CrudConfig<T>
) {
	const {
		endpoint,
		getQuery,
		entityName,
		initialFormData,
		generateId = () => crypto.randomUUID(),
		onSaveSuccess,
		onDeleteSuccess,
		toApi,
		fromApi,
	} = config;

	// State
	const [items, setItems] = useState<T[]>([]);
	const [formData, setFormData] = useState<T>(
		{ ...initialFormData, id: generateId() } as T
	);
	const [editing, setEditing] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	/**
	 * Load all items from API
	 */
	const loadItems = useCallback(async () => {
		setLoading(true);
		try {
			const query = (getQuery as GetQuery | undefined)?.();
			const url =
				query && query.trim().length > 0 ? `${endpoint}${query}` : endpoint;

			const result = await apiGet<T[]>(url);

			if (!result.success || !result.data) {
				throw new Error(result.error || "Failed to load items");
			}

			const data = fromApi
				? result.data.map((item) => fromApi(item) as T)
				: result.data;

			setItems(data);
		} catch (err) {
			console.error(`Failed to load ${entityName}s:`, err);
			toast.error(
				err instanceof Error ? err.message : `Failed to load ${entityName}s`
			);
		} finally {
			setLoading(false);
		}
	}, [endpoint, entityName, fromApi, getQuery]);

	/**
	 * Save (create or update) an item
	 */
	const saveItem = useCallback(
		async (data?: Partial<T>) => {
			const itemToSave = data ? ({ ...formData, ...data } as T) : formData;

			// Use existing ID if editing, otherwise generate new one
			if (!editing && !itemToSave.id) {
				itemToSave.id = generateId();
			}

			setSaving(true);
			try {
				const payload = toApi ? toApi(itemToSave) : itemToSave;
				const result = await apiPost<T, unknown>(endpoint, payload);

				if (!result.success) {
					throw new Error(result.error || "Failed to save");
				}

				toast.success(
					editing
						? `${entityName} updated successfully`
						: `${entityName} created successfully`
				);

				await loadItems();
				resetForm();
				onSaveSuccess?.(itemToSave);
			} catch (err) {
				console.error(`Failed to save ${entityName}:`, err);
				toast.error(
					err instanceof Error ? err.message : `Failed to save ${entityName}`
				);
			} finally {
				setSaving(false);
			}
		},
		[
			formData,
			editing,
			endpoint,
			entityName,
			generateId,
			toApi,
			loadItems,
			onSaveSuccess,
		]
	);

	/**
	 * Delete an item
	 */
	const deleteItem = useCallback(
		async (id: string) => {
			try {
				const result = await apiDelete(endpoint, id);

				if (!result.success) {
					throw new Error(result.error || "Failed to delete");
				}

				toast.success(`${entityName} deleted successfully`);

				await loadItems();

				// If we're editing the deleted item, reset the form
				if (editing?.id === id) {
					resetForm();
				}

				onDeleteSuccess?.(id);
			} catch (err) {
				console.error(`Failed to delete ${entityName}:`, err);
				toast.error(
					err instanceof Error ? err.message : `Failed to delete ${entityName}`
				);
			}
		},
		[endpoint, entityName, editing, loadItems, onDeleteSuccess]
	);

	/**
	 * Load an item into the form for editing
	 */
	const editItem = useCallback((item: T) => {
		setFormData(item);
		setEditing(item);
	}, []);

	/**
	 * Cancel editing and reset form
	 */
	const cancelEdit = useCallback(() => {
		resetForm();
	}, []);

	/**
	 * Update a single field in the form
	 */
	const updateField = useCallback(
		<K extends keyof T>(field: K, value: T[K]) => {
			setFormData((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	/**
	 * Update multiple fields at once
	 */
	const updateFields = useCallback((updates: Partial<T>) => {
		setFormData((prev) => ({ ...prev, ...updates }));
	}, []);

	/**
	 * Reset form to initial state
	 */
	function resetForm() {
		setFormData({ ...initialFormData, id: generateId() } as T);
		setEditing(null);
	}

	// Load items on mount
	useEffect(() => {
		loadItems();
	}, [loadItems]);

	return {
		// Data
		items,
		formData,
		editing,

		// States
		loading,
		saving,

		// Form management
		updateField,
		updateFields,
		setFormData,
		resetForm,
		editItem,
		cancelEdit,

		// CRUD operations
		loadItems,
		saveItem,
		deleteItem,
	};
}
