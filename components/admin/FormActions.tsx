"use client";

interface ButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	type?: "button" | "submit";
	className?: string;
}

export function PrimaryButton({
	children,
	onClick,
	disabled,
	type = "button",
	className = "",
}: ButtonProps) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 ${className}`.trim()}
		>
			{children}
		</button>
	);
}

export function CancelButton({
	children = "Cancel",
	onClick,
	disabled,
	type = "button",
	className = "",
}: ButtonProps) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`rounded-lg border border-zinc-300 px-6 py-2 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${className}`.trim()}
		>
			{children}
		</button>
	);
}

export function DeleteButton({
	children = "Delete",
	onClick,
	disabled,
	type = "button",
	className = "",
}: ButtonProps) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`rounded-lg border border-red-300 px-4 py-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 ${className}`.trim()}
		>
			{children}
		</button>
	);
}

interface FormActionsProps {
	saving?: boolean;
	isEditing?: boolean;
	onSave: () => void;
	onCancel?: () => void;
	onDelete?: () => void;
	saveLabel?: string;
	saveEditLabel?: string;
	disabled?: boolean;
}

export function FormActions({
	saving,
	isEditing,
	onSave,
	onCancel,
	onDelete,
	saveLabel = "Save",
	saveEditLabel = "Update",
	disabled,
}: FormActionsProps) {
	return (
		<div className="flex gap-2">
			<PrimaryButton onClick={onSave} disabled={saving || disabled}>
				{saving ? "Saving..." : isEditing ? saveEditLabel : saveLabel}
			</PrimaryButton>
			{isEditing && onDelete && (
				<DeleteButton onClick={onDelete} disabled={saving}>
					Delete
				</DeleteButton>
			)}
			{isEditing && onCancel && (
				<CancelButton onClick={onCancel} disabled={saving}>
					Cancel
				</CancelButton>
			)}
		</div>
	);
}

