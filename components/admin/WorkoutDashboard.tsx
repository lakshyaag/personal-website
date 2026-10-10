"use client";

import { ExerciseHistoryCard } from "@/components/admin/ExerciseHistoryCard";
import { ExerciseHistoryModal } from "@/components/admin/ExerciseHistoryModal";
import { ExerciseSearch } from "@/components/admin/ExerciseSearch";
import { adminRequest } from "@/components/admin/client";
import {
	AdminPage,
	ListStatus,
	Segmented,
	message,
} from "@/components/admin/kit";
import {
	CalendarHeatmap,
	MuscleGroupChart,
	VolumeChart,
} from "@/components/admin/workout-charts";
import type { WorkoutExercise } from "@/shared/workouts";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

const timeViews = [
	{ value: "week", label: "By week" },
	{ value: "day", label: "By day" },
] as const;

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-3">
			<div>
				<h2 className="text-lg font-medium">{title}</h2>
				{hint && <p className="text-sm text-zinc-500">{hint}</p>}
			</div>
			{children}
		</section>
	);
}

type LastSession = {
	name: string;
	lastPerformed: string;
	sets: NonNullable<WorkoutExercise["sets"]>;
	notes?: string | null;
};

/** Looks up the last time you did an exercise, with the full history one tap away. */
function ExerciseLookup() {
	const [selected, setSelected] = useState<LastSession | null>(null);
	const [showHistory, setShowHistory] = useState(false);
	async function select(exercise: { canonicalName: string }) {
		const name = exercise.canonicalName;
		try {
			const { history } = await adminRequest<{
				history: {
					date: string;
					sets: LastSession["sets"];
					notes?: string | null;
				}[];
			}>(`workouts/exercises/${encodeURIComponent(name)}`);
			const last = history[0];
			setSelected(
				last
					? {
							name,
							lastPerformed: last.date,
							sets: last.sets,
							notes: last.notes,
						}
					: {
							name,
							lastPerformed: "Never",
							sets: [],
							notes: "No history found.",
						},
			);
		} catch (error) {
			toast.error(message(error, "Failed to load exercise history"));
		}
	}
	return (
		<Section title="Exercise lookup">
			<ExerciseSearch onSelect={select} />
			{selected && (
				<ExerciseHistoryCard
					exerciseName={selected.name}
					lastPerformed={selected.lastPerformed}
					sets={selected.sets}
					notes={selected.notes}
					onViewHistory={() => setShowHistory(true)}
					onClear={() => setSelected(null)}
				/>
			)}
			{showHistory && selected && (
				<ExerciseHistoryModal
					exerciseName={selected.name}
					onClose={() => setShowHistory(false)}
				/>
			)}
		</Section>
	);
}

export default function WorkoutDashboard() {
	const [stats, setStats] = useState<WorkoutStats | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState(0);
	const [timeView, setTimeView] = useState<TimeView>("week");

	// biome-ignore lint/correctness/useExhaustiveDependencies: version triggers a retry.
	useEffect(() => {
		setError(null);
		adminRequest<WorkoutStats>("workouts/stats")
			.then(setStats)
			.catch((reason) => setError(message(reason, "Failed to load stats")));
	}, [version]);

	return (
		<AdminPage
			title="Workout stats"
			actions={
				<Link
					href="/admin/workouts"
					className="flex items-center gap-1 text-sm font-medium"
				>
					<ChevronLeft className="h-4 w-4" />
					Logs
				</Link>
			}
		>
			<ExerciseLookup />
			<ListStatus
				loading={!stats && !error}
				error={error}
				onRetry={() => setVersion((value) => value + 1)}
			/>
			{stats && (
				<>
					<Segmented
						label="Group by"
						value={timeView}
						options={timeViews}
						onChange={setTimeView}
					/>
					<Section
						title="Consistency"
						hint="Last 3 months. Darker = more volume."
					>
						<CalendarHeatmap dailyStats={stats.dailyStats} />
					</Section>
					<Section
						title={`${timeView === "week" ? "Weekly" : "Daily"} volume`}
						hint={`Total training volume per ${timeView} (lbs)`}
					>
						<VolumeChart
							data={
								timeView === "week" ? stats.weeklyVolume : stats.dailyVolume
							}
							mode={timeView}
						/>
					</Section>
					<Section
						title="Muscle groups"
						hint="Sets per muscle group. Tap a bar for the breakdown."
					>
						<MuscleGroupChart
							data={
								timeView === "week"
									? stats.muscleGroupsByWeek
									: stats.muscleGroupsByDay
							}
							allMuscleGroups={stats.allMuscleGroups}
							mode={timeView}
						/>
					</Section>
				</>
			)}
		</AdminPage>
	);
}
