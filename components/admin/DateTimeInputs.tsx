"use client";

import { useId } from "react";

const INPUT_CLASSES =
	"w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

interface BaseInputProps {
	label?: string;
	id?: string;
	name?: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	required?: boolean;
	min?: string;
	max?: string;
	className?: string;
}

interface TimeInputProps extends BaseInputProps {
	step?: number | string;
}

export function DateInput({
	label = "Date",
	id,
	name,
	value,
	onChange,
	disabled,
	required,
	min,
	max,
	className = "",
}: BaseInputProps) {
	const inputId = id ?? useId();

	return (
		<div>
			{label && (
				<label
					htmlFor={inputId}
					className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
				>
					{label}
				</label>
			)}
			<input
				id={inputId}
				name={name}
				type="date"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				required={required}
				min={min}
				max={max}
				className={`${INPUT_CLASSES} ${className}`.trim()}
			/>
		</div>
	);
}

export function TimeInput({
	label = "Time",
	id,
	name,
	value,
	onChange,
	disabled,
	required,
	min,
	max,
	step,
	className = "",
}: TimeInputProps) {
	const inputId = id ?? useId();

	return (
		<div>
			{label && (
				<label
					htmlFor={inputId}
					className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
				>
					{label}
				</label>
			)}
			<input
				id={inputId}
				name={name}
				type="time"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				required={required}
				min={min}
				max={max}
				step={step}
				className={`${INPUT_CLASSES} ${className}`.trim()}
			/>
		</div>
	);
}

interface DateTimeInputProps {
	dateLabel?: string;
	timeLabel?: string;
	dateValue: string;
	timeValue: string;
	onDateChange: (value: string) => void;
	onTimeChange: (value: string) => void;
	disabled?: boolean;
	requiredDate?: boolean;
	requiredTime?: boolean;
	dateId?: string;
	timeId?: string;
}

export function DateTimeInput({
	dateLabel = "Date",
	timeLabel = "Time",
	dateValue,
	timeValue,
	onDateChange,
	onTimeChange,
	disabled,
	requiredDate,
	requiredTime,
	dateId,
	timeId,
}: DateTimeInputProps) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<DateInput
				label={dateLabel}
				id={dateId}
				value={dateValue}
				onChange={onDateChange}
				disabled={disabled}
				required={requiredDate}
			/>
			<TimeInput
				label={timeLabel}
				id={timeId}
				value={timeValue}
				onChange={onTimeChange}
				disabled={disabled}
				required={requiredTime}
			/>
		</div>
	);
}

export default DateInput;

