"use client";

import { useMemo } from "react";
import { formatLocalDate } from "./utils";

interface DailyStats {
	[date: string]: { volume: number; count: number };
}

interface CalendarHeatmapProps {
	dailyStats: DailyStats;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const INTENSITY_CLASSES = [
	"bg-zinc-100 dark:bg-zinc-800",
	"bg-purple-200 dark:bg-purple-900/40",
	"bg-purple-300 dark:bg-purple-800/60",
	"bg-purple-400 dark:bg-purple-700/80",
	"bg-purple-500 dark:bg-purple-600",
] as const;

function getIntensityClass(volume: number, maxVolume: number): string {
	if (volume === 0) return INTENSITY_CLASSES[0];
	const ratio = volume / maxVolume;
	if (ratio < 0.25) return INTENSITY_CLASSES[1];
	if (ratio < 0.5) return INTENSITY_CLASSES[2];
	if (ratio < 0.75) return INTENSITY_CLASSES[3];
	return INTENSITY_CLASSES[4];
}

export function CalendarHeatmap({ dailyStats }: CalendarHeatmapProps) {
	const { weeks, maxVolume, monthLabels } = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const threeMonthsAgo = new Date(today);
		threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

		const startDay = threeMonthsAgo.getDay();
		const adjustedStart = new Date(threeMonthsAgo);
		adjustedStart.setDate(
			threeMonthsAgo.getDate() - (startDay === 0 ? 6 : startDay - 1),
		);

		const weeks: Array<Array<{ date: string; volume: number } | null>> = [];
		const monthLabels: Array<{ week: number; label: string }> = [];
		let currentWeek: Array<{ date: string; volume: number } | null> = [];
		let lastMonth = -1;

		const current = new Date(adjustedStart);
		while (current <= today) {
			const dateStr = formatLocalDate(current);
			const dayOfWeek = current.getDay();
			const mondayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

			if (mondayIndex === 0 && currentWeek.length > 0) {
				weeks.push(currentWeek);
				currentWeek = [];
			}

			const month = current.getMonth();
			if (month !== lastMonth && mondayIndex === 0) {
				monthLabels.push({ week: weeks.length, label: MONTHS[month] });
				lastMonth = month;
			}

			const stats = dailyStats[dateStr];
			currentWeek.push({ date: dateStr, volume: stats?.volume ?? 0 });
			current.setDate(current.getDate() + 1);
		}

		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) currentWeek.push(null);
			weeks.push(currentWeek);
		}

		const allVolumes = Object.values(dailyStats).map((s) => s.volume);
		const maxVolume = Math.max(...allVolumes, 1);

		return { weeks, maxVolume, monthLabels };
	}, [dailyStats]);

	return (
		<div className="space-y-4">
			<div className="overflow-x-auto overflow-y-hidden">
				<div className="inline-flex gap-1 min-w-fit">
					<div className="flex flex-col gap-1 text-xs text-zinc-500 pr-1 pt-5 flex-shrink-0">
						{DAYS.map((day, i) => (
							<div key={day} className="h-3 flex items-center leading-none">
								{i % 2 === 0 ? day : ""}
							</div>
						))}
					</div>

					<div className="flex flex-col gap-1">
						<div className="flex gap-1 h-4 text-xs text-zinc-500">
							{monthLabels.map(({ week, label }, idx) => {
								const nextWeek = monthLabels[idx + 1]?.week ?? weeks.length;
								const span = nextWeek - week;
								return (
									<div
										key={`${week}-${label}`}
										style={{ width: `${span * 14 - 4}px` }}
									>
										{label}
									</div>
								);
							})}
						</div>

						<div className="flex gap-1">
							{weeks.map((week, weekIdx) => (
								<div key={`week-${weekIdx}`} className="flex flex-col gap-1">
									{week.map((day, dayIdx) =>
										day ? (
											<div
												key={day.date}
												className={`w-3 h-3 rounded-sm ${getIntensityClass(day.volume, maxVolume)} cursor-pointer`}
												title={`${day.date}: ${day.volume.toLocaleString()} lbs`}
											/>
										) : (
											<div
												key={`empty-${weekIdx}-${dayIdx}`}
												className="w-3 h-3"
											/>
										),
									)}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2 text-xs text-zinc-500">
				<span>Less</span>
				<div className="flex gap-1">
					{INTENSITY_CLASSES.map((cls, i) => (
						<div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
					))}
				</div>
				<span>More</span>
			</div>
		</div>
	);
}
