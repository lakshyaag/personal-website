/**
 * Generic API utilities for admin modules
 * Provides typed fetch functions with consistent error handling
 */

import type { ApiResponse } from "./admin-types";

/**
 * Base fetch with error handling
 */
async function apiFetch<T>(
	url: string,
	options?: RequestInit
): Promise<ApiResponse<T>> {
	try {
		const response = await fetch(url, options);

		if (!response.ok) {
			const error = await response.text();
			return {
				success: false,
				error: error || `Request failed with status ${response.status}`,
			};
		}

		const data = await response.json();
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "An unknown error occurred",
		};
	}
}

/**
 * GET request
 */
export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
	return apiFetch<T>(url, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * POST request
 */
export async function apiPost<T, D = unknown>(
	url: string,
	data: D
): Promise<ApiResponse<T>> {
	return apiFetch<T>(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

/**
 * DELETE request
 */
export async function apiDelete<T = void>(
	url: string,
	id: string
): Promise<ApiResponse<T>> {
	return apiFetch<T>(`${url}?id=${encodeURIComponent(id)}`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Upload a file (FormData)
 */
export async function apiUpload(
	url: string,
	file: File,
	folder: string,
	identifier: string
): Promise<ApiResponse<{ url: string }>> {
	try {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("folder", folder);
		formData.append("identifier", identifier);

		const response = await fetch(url, {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			const error = await response.text();
			return {
				success: false,
				error: error || `Upload failed with status ${response.status}`,
			};
		}

		const data = await response.json();
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Upload failed unexpectedly",
		};
	}
}

/**
 * Create a typed API client for a specific endpoint
 */
export function createApiClient<T extends { id: string }>(endpoint: string) {
	return {
		/** Get all items */
		async getAll(): Promise<ApiResponse<T[]>> {
			return apiGet<T[]>(endpoint);
		},

		/** Get a single item by ID */
		async getById(id: string): Promise<ApiResponse<T>> {
			return apiGet<T>(`${endpoint}?id=${encodeURIComponent(id)}`);
		},

		/** Get items by date (for date-based entries) */
		async getByDate(date: string): Promise<ApiResponse<T[]>> {
			return apiGet<T[]>(`${endpoint}?date=${encodeURIComponent(date)}`);
		},

		/** Get grouped items (for date-based entries) */
		async getGrouped(): Promise<ApiResponse<Record<string, T[]>>> {
			return apiGet<Record<string, T[]>>(`${endpoint}?grouped=true`);
		},

		/** Save (create or update) an item */
		async save(item: T): Promise<ApiResponse<T>> {
			return apiPost<T, T>(endpoint, item);
		},

		/** Delete an item by ID */
		async delete(id: string): Promise<ApiResponse<void>> {
			return apiDelete<void>(endpoint, id);
		},
	};
}

/**
 * Handle API errors with toast notifications
 */
export function handleApiError(error: string, context: string): void {
	console.error(`${context}:`, error);
	// Note: Toast should be called from components that import 'sonner'
	// This is just for logging
}
