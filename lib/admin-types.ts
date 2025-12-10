/**
 * Shared type definitions for admin modules
 * Common interfaces for CRUD operations
 */

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
	/** Called after form reset (for custom cleanup like clearing URL params) */
	onReset?: () => void;
	/** Transform data before sending to API */
	toApi?: (data: T) => unknown;
	/** Transform data received from API */
	fromApi?: (data: unknown) => T;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}
