"use client";

import { useId } from "react";

const INPUT_CLASSES =
	"w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const LABEL_CLASSES =
	"mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

interface BaseInputProps {
	label?: string;
	id?: string;
	name?: string;
	disabled?: boolean;
	required?: boolean;
	className?: string;
	placeholder?: string;
}

interface TextInputProps extends BaseInputProps {
	value: string;
	onChange: (value: string) => void;
	type?: "text" | "email" | "url" | "search";
}

export function TextInput({
	label,
	id,
	name,
	value,
	onChange,
	disabled,
	required,
	className = "",
	placeholder,
	type = "text",
}: TextInputProps) {
	const inputId = id ?? useId();

	return (
		<div>
			{label && (
				<label htmlFor={inputId} className={LABEL_CLASSES}>
					{label}
				</label>
			)}
			<input
				id={inputId}
				name={name}
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				required={required}
				placeholder={placeholder}
				className={`${INPUT_CLASSES} ${className}`.trim()}
			/>
		</div>
	);
}

interface TextAreaProps extends BaseInputProps {
	value: string;
	onChange: (value: string) => void;
	rows?: number;
}

export function TextArea({
	label,
	id,
	name,
	value,
	onChange,
	disabled,
	required,
	className = "",
	placeholder,
	rows = 4,
}: TextAreaProps) {
	const inputId = id ?? useId();

	return (
		<div>
			{label && (
				<label htmlFor={inputId} className={LABEL_CLASSES}>
					{label}
				</label>
			)}
			<textarea
				id={inputId}
				name={name}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				required={required}
				placeholder={placeholder}
				rows={rows}
				className={`${INPUT_CLASSES} ${className}`.trim()}
			/>
		</div>
	);
}

interface NumberInputProps extends BaseInputProps {
	value: string | number;
	onChange: (value: string) => void;
	min?: number;
	max?: number;
	step?: number | string;
}

export function NumberInput({
	label,
	id,
	name,
	value,
	onChange,
	disabled,
	required,
	className = "",
	placeholder,
	min,
	max,
	step,
}: NumberInputProps) {
	const inputId = id ?? useId();

	return (
		<div>
			{label && (
				<label htmlFor={inputId} className={LABEL_CLASSES}>
					{label}
				</label>
			)}
			<input
				id={inputId}
				name={name}
				type="number"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				required={required}
				placeholder={placeholder}
				min={min}
				max={max}
				step={step}
				className={`${INPUT_CLASSES} ${className}`.trim()}
			/>
		</div>
	);
}

interface SelectOption {
	value: string;
	label: string;
}

interface SelectInputProps extends BaseInputProps {
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
}

export function SelectInput({
	label,
	id,
	name,
	value,
	onChange,
	disabled,
	required,
	className = "",
	options,
}: SelectInputProps) {
	const inputId = id ?? useId();

	return (
		<div>
			{label && (
				<label htmlFor={inputId} className={LABEL_CLASSES}>
					{label}
				</label>
			)}
			<select
				id={inputId}
				name={name}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				required={required}
				className={`${INPUT_CLASSES} ${className}`.trim()}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	);
}

interface CheckboxInputProps extends Omit<BaseInputProps, "placeholder"> {
	checked: boolean;
	onChange: (checked: boolean) => void;
}

export function CheckboxInput({
	label,
	id,
	name,
	checked,
	onChange,
	disabled,
	className = "",
}: CheckboxInputProps) {
	const inputId = id ?? useId();

	return (
		<label
			className={`flex items-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 ${className}`.trim()}
		>
			<input
				id={inputId}
				name={name}
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				disabled={disabled}
				className="rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
			/>
			{label && (
				<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
					{label}
				</span>
			)}
		</label>
	);
}

