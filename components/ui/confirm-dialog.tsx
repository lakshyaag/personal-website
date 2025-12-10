"use client";

import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	variant?: "default" | "danger";
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

function ConfirmDialogComponent({
	isOpen,
	title,
	message,
	variant = "default",
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				onCancel();
			}
		};

		if (isOpen) {
			document.body.style.overflow = "hidden";
			document.addEventListener("keydown", handleEscape);
		}

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, onCancel]);

	// Avoid rendering on the server
	if (typeof document === "undefined") return null;

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onCancel}
						className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
					/>

					{/* Dialog */}
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 10 }}
							transition={{ duration: 0.2 }}
							className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
							role="alertdialog"
							aria-labelledby="confirm-dialog-title"
							aria-describedby="confirm-dialog-message"
						>
							{/* Title */}
							<h2
								id="confirm-dialog-title"
								className="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
							>
								{title}
							</h2>

							{/* Message */}
							<p
								id="confirm-dialog-message"
								className="mt-3 text-sm text-zinc-600 dark:text-zinc-400"
							>
								{message}
							</p>

							{/* Actions */}
							<div className="mt-6 flex gap-3">
								<button
									type="button"
									onClick={onCancel}
									className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
								>
									{cancelLabel}
								</button>
								<button
									type="button"
									onClick={onConfirm}
									className={cn(
										"flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2",
										variant === "danger"
											? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800"
											: "bg-zinc-900 text-white hover:bg-zinc-800 focus:ring-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
									)}
									autoFocus
								>
									{confirmLabel}
								</button>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>,
		document.body
	);
}

// State management for imperative API
let resolveCallback: ((value: boolean) => void) | null = null;
let dialogState = {
	isOpen: false,
	title: "",
	message: "",
	variant: "default" as "default" | "danger",
	confirmLabel: "Confirm",
	cancelLabel: "Cancel",
};

const listeners = new Set<() => void>();

function notifyListeners() {
	listeners.forEach((listener) => listener());
}

/**
 * Confirmation dialog hook
 * Returns a function to show the dialog imperatively
 */
export function useConfirmDialog() {
	const [state, setState] = useState(dialogState);

	useEffect(() => {
		const listener = () => setState({ ...dialogState });
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);

	const confirm = (options: {
		title: string;
		message: string;
		variant?: "default" | "danger";
		confirmLabel?: string;
		cancelLabel?: string;
	}): Promise<boolean> => {
		return new Promise((resolve) => {
			resolveCallback = resolve;
			dialogState = {
				isOpen: true,
				title: options.title,
				message: options.message,
				variant: options.variant || "default",
				confirmLabel: options.confirmLabel || "Confirm",
				cancelLabel: options.cancelLabel || "Cancel",
			};
			notifyListeners();
		});
	};

	const handleConfirm = () => {
		dialogState.isOpen = false;
		notifyListeners();
		if (resolveCallback) {
			resolveCallback(true);
			resolveCallback = null;
		}
	};

	const handleCancel = () => {
		dialogState.isOpen = false;
		notifyListeners();
		if (resolveCallback) {
			resolveCallback(false);
			resolveCallback = null;
		}
	};

	return {
		confirm,
		ConfirmDialog: () => (
			<ConfirmDialogComponent
				{...state}
				onConfirm={handleConfirm}
				onCancel={handleCancel}
			/>
		),
	};
}

// Export the component for direct use if needed
export { ConfirmDialogComponent as ConfirmDialog };
