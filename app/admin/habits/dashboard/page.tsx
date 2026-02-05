"use client";

import { useState, useEffect, useMemo } from "react";
import { Flame, TrendingUp, Calendar } from "lucide-react";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import { formatLocalDate } from "@/components/admin/workout-charts/utils";

interface HabitStats {
	id: string;
	name: string;
	emoji?: string;
	type: "auto" | "manual";
	currentStreak: number;
	longestStreak: number;
	last30Days: number;
	last7Days: number;
}

interface DailyCompletion {
	date: string;
	completedCount: number;
	totalCount: number;
	percentage: number;
}

interface StatsResponse {
	habits: HabitStats[];
	dailyCompletions: DailyCompletion[];
	totalHabits: number;
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
	"bg-green-200 dark:bg-green-900/40",
	"bg-green-300 dark:bg-green-800/60",
	"bg-green-400 dark:bg-green-700/80",
	"bg-green-500 dark:bg-green-600",
] as const;

function getIntensityClass(percentage: number): string {
	if (percentage === 0) return INTENSITY_CLASSES[0];
	if (percentage < 25) return INTENSITY_CLASSES[1];
	if (percentage < 50) return INTENSITY_CLASSES[2];
	if (percentage < 75) return INTENSITY_CLASSES[3];
	return INTENSITY_CLASSES[4];
}

// Calendar heatmap component
function HabitHeatmap({
	dailyCompletions,
}: {
	dailyCompletions: DailyCompletion[];
}) {
	const { weeks, monthLabels } = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const threeMonthsAgo = new Date(today);
		threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

		const startDay = threeMonthsAgo.getDay();
		const adjustedStart = new Date(threeMonthsAgo);
		adjustedStart.setDate(
			threeMonthsAgo.getDate() - (startDay === 0 ? 6 : startDay - 1),
		);

		// Create a map for quick lookup
		const completionMap = new Map<string, DailyCompletion>();
		for (const completion of dailyCompletions) {
			completionMap.set(completion.date, completion);
		}

		const weeks: Array<
			Array<{ date: string; percentage: number } | null>
		> = [];
		const monthLabels: Array<{ week: number; label: string }> = [];
		let currentWeek: Array<{ date: string; percentage: number } | null> = [];
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

			const completion = completionMap.get(dateStr);
			currentWeek.push({
				date: dateStr,
				percentage: completion?.percentage ?? 0,
			});
			current.setDate(current.getDate() + 1);
		}

		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) currentWeek.push(null);
			weeks.push(currentWeek);
		}

		return { weeks, monthLabels };
	}, [dailyCompletions]);

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
												className={`w-3 h-3 rounded-sm ${getIntensityClass(day.percentage)} cursor-pointer`}
												title={`${day.date}: ${day.percentage}% completed`}
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

// Stat card component
function StatCard({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string | number;
	icon: typeof Flame;
}) {
	return (
		<div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50">
			<div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
				<Icon size={16} />
				<span className="text-sm">{label}</span>
			</div>
			<div className="text-2xl font-semibold">{value}</div>
		</div>
	);
}

export default function HabitsDashboardPage() {
	const [stats, setStats] = useState<StatsResponse | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadStats() {
			try {
				const res = await fetch("/api/habits/stats");
				const data = await res.json();
				setStats(data);
			} catch (error) {
				console.error("Failed to load stats:", error);
			} finally {
				setLoading(false);
			}
		}
		loadStats();
	}, []);

	if (loading) {
		return (
			<AdminPageWrapper>
				<PageHeader
					title="Habits Dashboard"
					description="Track your consistency and progress"
				/>
				<AdminSection>
					<p className="text-center text-zinc-500 py-12">Loading stats...</p>
				</AdminSection>
			</AdminPageWrapper>
		);
	}

	if (!stats) {
		return (
			<AdminPageWrapper>
				<PageHeader
					title="Habits Dashboard"
					description="Track your consistency and progress"
				/>
				<AdminSection>
					<p className="text-center text-zinc-500 py-12">
						Failed to load stats
					</p>
				</AdminSection>
			</AdminPageWrapper>
		);
	}

	// Calculate overall stats
	const totalCurrentStreaks = stats.habits.reduce(
		(sum, h) => sum + h.currentStreak,
		0,
	);
	const avgCompletionRate =
		stats.dailyCompletions.length > 0
			? Math.round(
					stats.dailyCompletions.reduce(
						(sum, d) => sum + d.percentage,
						0,
					) / stats.dailyCompletions.length,
				)
			: 0;
	const best7DayHabit = stats.habits.reduce(
		(best, h) => (h.last7Days > (best?.last7Days ?? 0) ? h : best),
		stats.habits[0],
	);

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Habits Dashboard"
				description="Track your consistency and progress"
				backLink={{ href: "/admin/habits", label: "Back to Habits" }}
			/>

			{/* Quick Stats */}
			<AdminSection>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<StatCard
						label="Active Habits"
						value={stats.totalHabits}
						icon={Calendar}
					/>
					<StatCard
						label="Combined Streaks"
						value={`${totalCurrentStreaks} days`}
						icon={Flame}
					/>
					<StatCard
						label="Avg Completion"
						value={`${avgCompletionRate}%`}
						icon={TrendingUp}
					/>
					<StatCard
						label="Best This Week"
						value={
							best7DayHabit
								? `${best7DayHabit.emoji || ""} ${best7DayHabit.name}`
								: "-"
						}
						icon={TrendingUp}
					/>
				</div>
			</AdminSection>

			{/* Heatmap */}
			<AdminSection>
				<div className="space-y-4">
					<SectionHeader title="Completion Calendar" />
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						Last 3 months. Darker = more habits completed that day.
					</p>
					<HabitHeatmap dailyCompletions={stats.dailyCompletions} />
				</div>
			</AdminSection>

			{/* Per-Habit Stats */}
			<AdminSection>
				<div className="space-y-4">
					<SectionHeader title="Habit Streaks" />
					<div className="space-y-2">
						{stats.habits.length === 0 ? (
							<p className="text-center text-zinc-500 py-4">No habits yet</p>
						) : (
							stats.habits.map((habit) => (
								<div
									key={habit.id}
									className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50"
								>
									<div className="flex items-center gap-3">
										<span className="text-xl">{habit.emoji || "📋"}</span>
										<div>
											<span className="font-medium">{habit.name}</span>
											{habit.type === "auto" && (
												<span className="ml-2 text-xs text-zinc-500">
													(auto)
												</span>
											)}
										</div>
									</div>

									<div className="flex items-center gap-6 text-sm">
										<div className="text-center">
											<div className="text-zinc-500 text-xs">Current</div>
											<div className="font-medium flex items-center justify-center gap-1">
												{habit.currentStreak > 0 && (
													<Flame size={14} className="text-orange-500" />
												)}
												{habit.currentStreak}
											</div>
										</div>
										<div className="text-center">
											<div className="text-zinc-500 text-xs">Best</div>
											<div className="font-medium">{habit.longestStreak}</div>
										</div>
										<div className="text-center">
											<div className="text-zinc-500 text-xs">7 days</div>
											<div className="font-medium">{habit.last7Days}/7</div>
										</div>
										<div className="text-center">
											<div className="text-zinc-500 text-xs">30 days</div>
											<div className="font-medium">{habit.last30Days}/30</div>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</AdminSection>
		</AdminPageWrapper>
	);
}
