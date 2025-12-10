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
