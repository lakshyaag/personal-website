/**
 * Shared type definitions for admin modules
 * Common interfaces for CRUD operations, form state, and entry management
 */

/**
 * Base interface for all admin entries with date
 */
export interface DateBasedEntry {
	id: string;
	date: string; // YYYY-MM-DD
	createdAt?: string; // ISO timestamp
	photos?: string[];
}

/**
 * Configuration for generic CRUD operations
 */
export interface CrudConfig<T> {
	/** API endpoint (e.g., "/api/workouts") */
	endpoint: string;
	/** Optional query string builder for GET requests (e.g., "?date=2025-01-01") */
	getQuery?: () => string | null | undefined;
	/** Entity name for display/errors (e.g., "workout") */
	entityName: string;
	/** Initial form state */
	initialFormData: Omit<T, "id">;
	/** Folder name for photo uploads (e.g., "workouts") */
	folder?: string;
	/** Custom ID generator (default: crypto.randomUUID) */
	generateId?: () => string;
	/** Called after successful save */
	onSaveSuccess?: (item: T) => void;
	/** Called after successful delete */
	onDeleteSuccess?: (id: string) => void;
	/** Transform data before sending to API */
	toApi?: (data: T) => unknown;
	/** Transform data received from API */
	fromApi?: (data: unknown) => T;
}

/**
 * Form state for admin modules
 */
export interface AdminFormState<T> {
	/** Current form data */
	formData: T;
	/** Entry being edited (null if creating new) */
	editing: T | null;
	/** Whether save operation is in progress */
	saving: boolean;
	/** Update a single field */
	updateField: <K extends keyof T>(field: K, value: T[K]) => void;
	/** Load an entry for editing */
	editItem: (item: T) => void;
	/** Cancel editing and reset form */
	cancelEdit: () => void;
	/** Reset form to initial state */
	resetForm: () => void;
}

/**
 * CRUD operations state
 */
export interface AdminCrudState<T extends { id: string }> {
	/** All items */
	items: T[];
	/** Whether initial load is in progress */
	loading: boolean;
	/** Load all items from API */
	loadItems: () => Promise<void>;
	/** Save (create or update) an item */
	saveItem: (item: T) => Promise<void>;
	/** Delete an item by ID */
	deleteItem: (id: string) => Promise<void>;
}

/**
 * Combined admin state (form + CRUD)
 */
export type AdminState<T extends { id: string }> = AdminFormState<T> &
	AdminCrudState<T>;

/**
 * Configuration for entry manager components
 */
export interface EntryManagerConfig<T extends { id: string }> {
	/** API endpoint */
	endpoint: string;
	/** Entity name for display */
	entityName: string;
	/** Folder for photo uploads */
	folder: string;
	/** Initial form data */
	initialFormData: Omit<T, "id">;
	/** Whether entries have date field */
	hasDate?: boolean;
	/** Whether entries have time field (for date-based entries) */
	hasTime?: boolean;
	/** Empty state message */
	emptyMessage?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Photo upload result
 */
export interface PhotoUploadResult {
	url: string;
}

/**
 * Date entry query params
 */
export interface DateEntryParams {
	date?: string; // YYYY-MM-DD
	edit?: string; // Entry ID
	grouped?: boolean; // Group by date
}

/**
 * Grouped entries by date
 */
export interface GroupedEntries<T extends DateBasedEntry> {
	date: string;
	entries: T[];
}
