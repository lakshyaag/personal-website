"use client";

import { Check, Minus, Plus } from "lucide-react";
import { StreakBadge } from "./StreakBadge";

interface HabitCardProps {
	name: string;
	emoji?: string;
	type: "auto" | "manual";
	valueType: "boolean" | "count" | "duration";
	target?: number;
	completed: boolean;
	value?: number;
	streak: number;
	onToggle?: () => void;
	onValueChange?: (value: number) => void;
	disabled?: boolean;
}

export function HabitCard({
	name,
	emoji,
	type,
	valueType,
	target,
	completed,
	value,
	streak,
	onToggle,
	onValueChange,
	disabled = false,
}: HabitCardProps) {
	const isAuto = type === "auto";

	const handleIncrement = () => {
		if (onValueChange && value !== undefined) {
			onValueChange(value + 1);
		}
	};

	const handleDecrement = () => {
		if (onValueChange && value !== undefined && value > 0) {
			onValueChange(value - 1);
		}
	};

	return (
		<div
			className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
				completed
					? "border-green-500/50 bg-green-50 dark:bg-green-900/20"
					: "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50"
			}`}
		>
			<div className="flex items-center gap-3">
				{/* Emoji or checkbox */}
				{isAuto ? (
					<span className="text-xl w-8 text-center">
						{completed ? "✅" : emoji || "📋"}
					</span>
				) : valueType === "boolean" ? (
					<button
						type="button"
						onClick={onToggle}
						disabled={disabled}
						className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
							completed
								? "border-green-500 bg-green-500 text-white"
								: "border-zinc-300 dark:border-zinc-600 hover:border-green-400"
						} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
					>
						{completed && <Check size={16} />}
					</button>
				) : (
					<span className="text-xl w-8 text-center">{emoji || "📋"}</span>
				)}

				{/* Name and info */}
				<div>
					<span className="font-medium text-zinc-900 dark:text-zinc-100">
						{name}
					</span>
					{isAuto && (
						<span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
							(auto)
						</span>
					)}
				</div>
			</div>

			<div className="flex items-center gap-4">
				{/* Value controls for count/duration */}
				{!isAuto && valueType !== "boolean" && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleDecrement}
							disabled={disabled || (value ?? 0) <= 0}
							className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Minus size={14} />
						</button>
						<span className="w-16 text-center font-medium">
							{value ?? 0}
							{target && (
								<span className="text-zinc-400">/{target}</span>
							)}
							<span className="text-xs text-zinc-500 ml-1">
								{valueType === "duration" ? "min" : ""}
							</span>
						</span>
						<button
							type="button"
							onClick={handleIncrement}
							disabled={disabled}
							className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Plus size={14} />
						</button>
					</div>
				)}

				{/* Streak badge */}
				<StreakBadge streak={streak} />
			</div>
		</div>
	);
}
