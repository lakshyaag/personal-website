"use client";

import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import {
	CalendarHeatmap,
	MuscleGroupChart,
	VolumeChart,
} from "@/components/admin/workout-charts";
import { useEffect, useState } from "react";

type TimeView = "day" | "week";

interface DailyStats {
	[date: string]: { volume: number; count: number };
}

interface VolumeEntry {
	date?: string;
	week?: string;
	volume: number;
}

interface MuscleGroupEntry {
	date?: string;
	week?: string;
	muscles: Record<string, number>;
}

interface WorkoutStats {
	dailyStats: DailyStats;
	dailyVolume: VolumeEntry[];
	weeklyVolume: VolumeEntry[];
	muscleGroupsByDay: MuscleGroupEntry[];
	muscleGroupsByWeek: MuscleGroupEntry[];
	allMuscleGroups: string[];
}

function TimeViewToggle({
	view,
	onChange,
}: {
	view: TimeView;
	onChange: (view: TimeView) => void;
}) {
	const base = "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
	const active = "bg-purple-600 text-white dark:bg-purple-500";
	const inactive =
		"bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";

	return (
		<div className="flex gap-2">
			<button
				type="button"
				onClick={() => onChange("day")}
				className={`${base} ${view === "day" ? active : inactive}`}
			>
				By Day
			</button>
			<button
				type="button"
				onClick={() => onChange("week")}
				className={`${base} ${view === "week" ? active : inactive}`}
			>
				By Week
			</button>
		</div>
	);
}

export default function WorkoutDashboardPage() {
	const [stats, setStats] = useState<WorkoutStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [timeView, setTimeView] = useState<TimeView>("week");

	useEffect(() => {
		async function loadStats() {
			try {
				const res = await fetch("/api/workouts/stats");
				const data = await res.json();
				setStats(data);
			} catch (error) {
				console.error("Failed to load workout stats:", error);
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
					title="Workout Dashboard"
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
					title="Workout Dashboard"
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

	const volumeData =
		timeView === "week" ? stats.weeklyVolume : stats.dailyVolume;
	const muscleData =
		timeView === "week" ? stats.muscleGroupsByWeek : stats.muscleGroupsByDay;

	return (
		<AdminPageWrapper>
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<PageHeader
					title="Workout Dashboard"
					description="Track your consistency and progress"
				/>
				<TimeViewToggle view={timeView} onChange={setTimeView} />
			</div>

			<AdminSection>
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
					<div className="space-y-4">
						<SectionHeader title="Consistency" />
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							Last 3 months. Darker = higher volume.
						</p>
						<CalendarHeatmap dailyStats={stats.dailyStats} />
					</div>

					<div className="space-y-4">
						<SectionHeader
							title={`${timeView === "week" ? "Weekly" : "Daily"} Volume`}
						/>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							Total training volume per {timeView} (lbs)
						</p>
						<VolumeChart data={volumeData} mode={timeView} />
					</div>
				</div>
			</AdminSection>

			<AdminSection>
				<div className="space-y-4">
					<SectionHeader
						title={`Muscle Groups by ${timeView === "week" ? "Week" : "Day"}`}
					/>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						Sets per muscle group. Click a bar to view breakdown.
					</p>
					<MuscleGroupChart
						data={muscleData}
						allMuscleGroups={stats.allMuscleGroups}
						mode={timeView}
					/>
				</div>
			</AdminSection>
		</AdminPageWrapper>
	);
}
