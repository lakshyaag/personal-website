"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Shared form field styles for admin modules
 */
const inputClassName =
	"w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const labelClassName =
	"mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

/**
 * Text Input Field
 */
interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
}

export function FormInput({
	label,
	error,
	id,
	className,
	...props
}: FormInputProps) {
	const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<label htmlFor={inputId} className={labelClassName}>
				{label}
			</label>
			<input
				id={inputId}
				className={cn(inputClassName, error && "border-red-500", className)}
				{...props}
			/>
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

/**
 * Number Input Field
 */
interface FormNumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
}

export function FormNumberInput({
	label,
	error,
	id,
	className,
	...props
}: FormNumberInputProps) {
	const inputId = id || `number-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<label htmlFor={inputId} className={labelClassName}>
				{label}
			</label>
			<input
				type="number"
				id={inputId}
				className={cn(inputClassName, error && "border-red-500", className)}
				{...props}
			/>
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

/**
 * Date Input Field
 */
interface FormDateInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
}

export function FormDateInput({
	label,
	error,
	id,
	className,
	...props
}: FormDateInputProps) {
	const inputId = id || `date-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<label htmlFor={inputId} className={labelClassName}>
				{label}
			</label>
			<input
				type="date"
				id={inputId}
				className={cn(inputClassName, error && "border-red-500", className)}
				{...props}
			/>
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

/**
 * Time Input Field
 */
interface FormTimeInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
}

export function FormTimeInput({
	label,
	error,
	id,
	className,
	...props
}: FormTimeInputProps) {
	const inputId = id || `time-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<label htmlFor={inputId} className={labelClassName}>
				{label}
			</label>
			<input
				type="time"
				id={inputId}
				className={cn(inputClassName, error && "border-red-500", className)}
				{...props}
			/>
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

/**
 * Textarea Field
 */
interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label: string;
	error?: string;
}

export function FormTextarea({
	label,
	error,
	id,
	className,
	rows = 4,
	...props
}: FormTextareaProps) {
	const textareaId = id || `textarea-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<label htmlFor={textareaId} className={labelClassName}>
				{label}
			</label>
			<textarea
				id={textareaId}
				rows={rows}
				className={cn(inputClassName, error && "border-red-500", className)}
				{...props}
			/>
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

/**
 * File Input Field
 */
interface FormFileInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
	helperText?: string;
}

export function FormFileInput({
	label,
	error,
	helperText,
	id,
	className,
	...props
}: FormFileInputProps) {
	const inputId = id || `file-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<label htmlFor={inputId} className={labelClassName}>
				{label}
			</label>
			<input
				type="file"
				id={inputId}
				className={cn(
					inputClassName,
					"disabled:opacity-50",
					error && "border-red-500",
					className
				)}
				{...props}
			/>
			{helperText && !error && (
				<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
					{helperText}
				</p>
			)}
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

/**
 * Checkbox Field
 */
interface FormCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
}

export function FormCheckbox({
	label,
	error,
	id,
	className,
	...props
}: FormCheckboxProps) {
	const checkboxId =
		id || `checkbox-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<div className="flex items-center">
				<input
					type="checkbox"
					id={checkboxId}
					className={cn(
						"h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
						error && "border-red-500",
						className
					)}
					{...props}
				/>
				<label
					htmlFor={checkboxId}
					className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
				>
					{label}
				</label>
			</div>
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

/**
 * Select Field
 */
interface FormSelectProps
	extends React.SelectHTMLAttributes<HTMLSelectElement> {
	label: string;
	error?: string;
	options: Array<{ value: string; label: string }>;
}

export function FormSelect({
	label,
	error,
	options,
	id,
	className,
	...props
}: FormSelectProps) {
	const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div>
			<label htmlFor={selectId} className={labelClassName}>
				{label}
			</label>
			<select
				id={selectId}
				className={cn(inputClassName, error && "border-red-500", className)}
				{...props}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}
