"use client";

import { useState, useEffect } from "react";
import { TextInput, SelectInput, NumberInput } from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import type { Habit } from "@/lib/models";

interface HabitFormProps {
	habit?: Habit | null;
	saving: boolean;
	onSave: (habit: Partial<Habit>) => void;
	onCancel: () => void;
	onDelete?: () => void;
}

const EMOJI_OPTIONS = [
	{ value: "", label: "None" },
	{ value: "🏋️", label: "🏋️ Workout" },
	{ value: "🍽️", label: "🍽️ Food" },
	{ value: "📓", label: "📓 Journal" },
	{ value: "👕", label: "👕 Outfit" },
	{ value: "✈️", label: "✈️ Travel" },
	{ value: "🧘", label: "🧘 Meditate" },
	{ value: "📖", label: "📖 Read" },
	{ value: "💧", label: "💧 Water" },
	{ value: "🏃", label: "🏃 Exercise" },
	{ value: "😴", label: "😴 Sleep" },
	{ value: "💊", label: "💊 Vitamins" },
	{ value: "🚿", label: "🚿 Shower" },
	{ value: "📵", label: "📵 No Phone" },
];

const TYPE_OPTIONS = [
	{ value: "manual", label: "Manual (you check it off)" },
	{ value: "auto", label: "Auto (reads from tracker)" },
];

const VALUE_TYPE_OPTIONS = [
	{ value: "boolean", label: "Yes/No (checkbox)" },
	{ value: "count", label: "Count (times, glasses, etc.)" },
	{ value: "duration", label: "Duration (minutes)" },
];

const FREQUENCY_OPTIONS = [
	{ value: "daily", label: "Daily" },
	{ value: "weekly", label: "Weekly (X times per week)" },
];

const AUTO_SOURCE_OPTIONS = [
	{ value: "workouts", label: "Workout Logs" },
	{ value: "food", label: "Food Tracker" },
	{ value: "journal", label: "Journal" },
	{ value: "fits", label: "Fits Tracker" },
	{ value: "visits", label: "Airport Visits" },
];

export function HabitForm({
	habit,
	saving,
	onSave,
	onCancel,
	onDelete,
}: HabitFormProps) {
	const [name, setName] = useState("");
	const [emoji, setEmoji] = useState("");
	const [type, setType] = useState<"auto" | "manual">("manual");
	const [valueType, setValueType] = useState<"boolean" | "count" | "duration">(
		"boolean",
	);
	const [target, setTarget] = useState<number | undefined>(undefined);
	const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
	const [weeklyTarget, setWeeklyTarget] = useState<number | undefined>(
		undefined,
	);
	const [autoSource, setAutoSource] = useState<string>("");

	useEffect(() => {
		if (habit) {
			setName(habit.name);
			setEmoji(habit.emoji || "");
			setType(habit.type);
			setValueType(habit.valueType);
			setTarget(habit.target);
			setFrequency(
				habit.frequency === "specific_days" ? "daily" : habit.frequency,
			);
			setWeeklyTarget(habit.weeklyTarget);
			setAutoSource(habit.autoSource || "");
		} else {
			// Reset form
			setName("");
			setEmoji("");
			setType("manual");
			setValueType("boolean");
			setTarget(undefined);
			setFrequency("daily");
			setWeeklyTarget(undefined);
			setAutoSource("");
		}
	}, [habit]);

	const handleTargetChange = (value: string) => {
		const numValue = value === "" ? undefined : Number.parseInt(value, 10);
		setTarget(Number.isNaN(numValue) ? undefined : numValue);
	};

	const handleWeeklyTargetChange = (value: string) => {
		const numValue = value === "" ? undefined : Number.parseInt(value, 10);
		setWeeklyTarget(Number.isNaN(numValue) ? undefined : numValue);
	};

	const handleSubmit = () => {
		onSave({
			id: habit?.id,
			name,
			emoji: emoji || undefined,
			type,
			valueType: type === "auto" ? "boolean" : valueType,
			target: valueType !== "boolean" ? target : undefined,
			frequency,
			weeklyTarget: frequency === "weekly" ? weeklyTarget : undefined,
			autoSource: type === "auto" ? (autoSource as Habit["autoSource"]) : undefined,
			displayOrder: habit?.displayOrder ?? 0,
			archived: habit?.archived ?? false,
			createdAt: habit?.createdAt ?? new Date().toISOString(),
		});
	};

	const isValid = name.trim() && (type === "manual" || autoSource);

	return (
		<div className="space-y-4">
			<TextInput
				id="habit-name"
				label="Habit Name"
				value={name}
				onChange={setName}
				placeholder="e.g., Meditate, Drink water, Read"
			/>

			<SelectInput
				id="habit-emoji"
				label="Emoji (optional)"
				value={emoji}
				onChange={setEmoji}
				options={EMOJI_OPTIONS}
			/>

			<SelectInput
				id="habit-type"
				label="Type"
				value={type}
				onChange={(v) => setType(v as "auto" | "manual")}
				options={TYPE_OPTIONS}
			/>

			{type === "auto" && (
				<SelectInput
					id="habit-source"
					label="Auto Source"
					value={autoSource}
					onChange={setAutoSource}
					options={[
						{ value: "", label: "Select a tracker..." },
						...AUTO_SOURCE_OPTIONS,
					]}
				/>
			)}

			{type === "manual" && (
				<>
					<SelectInput
						id="habit-value-type"
						label="Tracking Type"
						value={valueType}
						onChange={(v) =>
							setValueType(v as "boolean" | "count" | "duration")
						}
						options={VALUE_TYPE_OPTIONS}
					/>

					{valueType !== "boolean" && (
						<NumberInput
							id="habit-target"
							label={`Daily Target (${valueType === "duration" ? "minutes" : "count"})`}
							value={target ?? 0}
							onChange={handleTargetChange}
							min={1}
						/>
					)}
				</>
			)}

			<SelectInput
				id="habit-frequency"
				label="Frequency"
				value={frequency}
				onChange={(v) => setFrequency(v as "daily" | "weekly")}
				options={FREQUENCY_OPTIONS}
			/>

			{frequency === "weekly" && (
				<NumberInput
					id="habit-weekly-target"
					label="Times per Week"
					value={weeklyTarget ?? 4}
					onChange={handleWeeklyTargetChange}
					min={1}
					max={7}
				/>
			)}

			<FormActions
				saving={saving}
				isEditing={!!habit}
				onSave={handleSubmit}
				onCancel={onCancel}
				onDelete={onDelete}
				disabled={!isValid}
				saveLabel="Save Habit"
				saveEditLabel="Update Habit"
			/>
		</div>
	);
}
