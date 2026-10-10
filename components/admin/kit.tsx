"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { adminRequest } from "./client";

/** The building blocks every admin page shares: header, list, "+" button, editor sheet, undo. */

export const message = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export const primaryButton =
	"rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
export const secondaryButton =
	"rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700";

export function AdminPage({
	title,
	actions,
	children,
}: {
	title: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-5">
			<div className="flex min-h-10 items-center justify-between gap-3">
				<h1 className="text-2xl font-semibold">{title}</h1>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
			{children}
		</div>
	);
}

/** The thumb-reachable "new" button. Sits above the phone tab bar. */
export function Fab({
	label,
	onClick,
}: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform active:scale-95 sm:right-8 sm:bottom-8 dark:bg-zinc-100 dark:text-zinc-900"
		>
			<Plus className="h-6 w-6" />
		</button>
	);
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: readonly { value: T; label: string }[];
	onChange: (value: T) => void;
	label: string;
}) {
	return (
		<div
			role="group"
			aria-label={label}
			className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
						value === option.value
							? "bg-white shadow-sm dark:bg-zinc-700"
							: "text-zinc-600 dark:text-zinc-400"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

/** Steps through days: ‹ date › plus a jump back to today. */
export function DayNav({
	value,
	onChange,
	today,
}: {
	value: string;
	onChange: (day: string) => void;
	today: string;
}) {
	const shift = (days: number) => {
		const [y, m, d] = value.split("-").map(Number);
		const next = new Date(y, m - 1, d + days);
		onChange(
			`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`,
		);
	};
	const iconButton =
		"flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700";
	return (
		<div className="flex items-center gap-2">
			<button
				type="button"
				aria-label="Previous day"
				className={iconButton}
				onClick={() => shift(-1)}
			>
				<ChevronLeft className="h-4 w-4" />
			</button>
			<input
				type="date"
				aria-label="Day"
				value={value}
				onChange={(event) => event.target.value && onChange(event.target.value)}
				className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700"
			/>
			<button
				type="button"
				aria-label="Next day"
				className={iconButton}
				onClick={() => shift(1)}
			>
				<ChevronRight className="h-4 w-4" />
			</button>
			{value !== today && (
				<button
					type="button"
					className="h-10 rounded-lg px-3 text-sm font-medium underline"
					onClick={() => onChange(today)}
				>
					Today
				</button>
			)}
		</div>
	);
}

export function GroupHeader({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="pt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
			{children}
		</h2>
	);
}

export function EmptyState({ children }: { children: React.ReactNode }) {
	return (
		<p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
			{children}
		</p>
	);
}

export function ListStatus({
	loading,
	error,
	onRetry,
}: {
	loading: boolean;
	error: string | null;
	onRetry: () => void;
}) {
	if (error)
		return (
			<div
				role="alert"
				className="rounded-xl border border-red-300 p-4 text-sm dark:border-red-800"
			>
				{error}{" "}
				<button type="button" className="underline" onClick={onRetry}>
					Retry
				</button>
			</div>
		);
	if (loading)
		return (
			<output className="block py-4 text-sm text-zinc-500">Loading…</output>
		);
	return null;
}

/** A tappable entry. Tapping the body opens the editor; `media` (photos) stays separately clickable. */
export function RecordCard({
	onOpen,
	label,
	children,
	media,
}: {
	onOpen: () => void;
	label: string;
	children: React.ReactNode;
	media?: React.ReactNode;
}) {
	return (
		<article className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
			<button
				type="button"
				aria-label={label}
				onClick={onOpen}
				className="block w-full p-4 text-left text-sm transition-colors active:bg-zinc-50 dark:active:bg-zinc-900"
			>
				{children}
			</button>
			{/* Collapses when the media renders nothing (no photos). */}
			{media && <div className="px-4 pb-4 empty:hidden">{media}</div>}
		</article>
	);
}

/** Bottom sheet on phones, side panel on larger screens. */
export function Sheet({
	open,
	onClose,
	title,
	children,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
				<Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-white shadow-xl transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[30rem] sm:rounded-none sm:data-ending-style:translate-x-full sm:data-ending-style:translate-y-0 sm:data-starting-style:translate-x-full sm:data-starting-style:translate-y-0 dark:bg-zinc-950">
					<div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
						<Dialog.Title className="text-base font-semibold">
							{title}
						</Dialog.Title>
						<Dialog.Close
							aria-label="Close"
							className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg"
						>
							<X className="h-5 w-5" />
						</Dialog.Close>
					</div>
					{children}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/**
 * The editor every page uses: a form in a sheet with Save (and Delete for existing records).
 * Closing with unsaved changes asks first.
 */
export function EditorSheet({
	title,
	onClose,
	onSubmit,
	onDelete,
	saving,
	canSubmit,
	dirty,
	submitLabel = "Save",
	children,
}: {
	title: string;
	onClose: () => void;
	onSubmit: () => void;
	onDelete?: () => void;
	saving: boolean;
	canSubmit: boolean;
	dirty: boolean;
	submitLabel?: string;
	children: React.ReactNode;
}) {
	const close = () => {
		if (saving) return;
		if (dirty && !window.confirm("Discard your changes?")) return;
		onClose();
	};
	// Leaving the page with unsaved changes also asks.
	useEffect(() => {
		if (!dirty) return;
		const unload = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", unload);
		return () => window.removeEventListener("beforeunload", unload);
	}, [dirty]);
	return (
		<Sheet open onClose={close} title={title}>
			<form
				className="flex min-h-0 flex-1 flex-col"
				onSubmit={(event) => {
					event.preventDefault();
					if (canSubmit && !saving) onSubmit();
				}}
			>
				<fieldset
					disabled={saving}
					className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
				>
					{children}
				</fieldset>
				<div className="flex items-center gap-2 border-t border-zinc-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-zinc-800">
					{onDelete && (
						<button
							type="button"
							disabled={saving}
							onClick={onDelete}
							className="rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 disabled:opacity-50 dark:text-red-400"
						>
							Delete
						</button>
					)}
					<button
						type="submit"
						disabled={!canSubmit || saving}
						className={`ml-auto ${primaryButton}`}
					>
						{saving ? "Saving…" : submitLabel}
					</button>
				</div>
			</form>
		</Sheet>
	);
}

/** Loads a list from the admin API. Changing `path` reloads; `reload()` refetches. */
export function useAdminList<T>(
	path: string | null,
	parse: (data: unknown) => T[],
) {
	const [items, setItems] = useState<T[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: version deliberately triggers a refetch.
	useEffect(() => {
		if (!path) return;
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		adminRequest(path, { signal: controller.signal })
			.then((data) => setItems(parse(data)))
			.catch((reason) => {
				if (!controller.signal.aborted)
					setError(message(reason, "Could not load"));
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [path, parse, version]);
	const reload = useCallback(() => setVersion((value) => value + 1), []);
	return { items, loading, error, reload };
}

/**
 * Delete with undo: the record disappears at once and the request goes out when the toast
 * closes. Leaving the page sends pending deletes immediately.
 */
export function useUndoDelete() {
	const pending = useRef(
		new Map<string, { path: string; toastId: string | number }>(),
	);
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
	const show = useCallback(
		(id: string) =>
			setHidden((current) => {
				const next = new Set(current);
				next.delete(id);
				return next;
			}),
		[],
	);
	const commit = useCallback(
		async (id: string, keepalive = false) => {
			const item = pending.current.get(id);
			if (!item) return;
			pending.current.delete(id);
			try {
				await adminRequest(item.path, { method: "DELETE", keepalive });
			} catch (error) {
				show(id);
				toast.error(message(error, "Could not delete"));
			}
		},
		[show],
	);
	useEffect(() => {
		const flush = () => {
			for (const [id, item] of pending.current) {
				toast.dismiss(item.toastId);
				void commit(id, true);
			}
		};
		window.addEventListener("pagehide", flush);
		return () => {
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [commit]);
	const remove = useCallback(
		(id: string, label: string, path: string) => {
			setHidden((current) => new Set(current).add(id));
			const toastId = toast(label, {
				duration: 5000,
				action: {
					label: "Undo",
					onClick: () => {
						pending.current.delete(id);
						show(id);
					},
				},
				onAutoClose: () => void commit(id),
				onDismiss: () => void commit(id),
			});
			pending.current.set(id, { path, toastId });
		},
		[commit, show],
	);
	return { hidden, remove };
}
