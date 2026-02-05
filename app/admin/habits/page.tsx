"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BarChart3, Plus, Pencil, Archive } from "lucide-react";
import { toast } from "sonner";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { HabitCard, HabitForm } from "@/components/admin/habits";
import type { Habit, HabitCompletion } from "@/lib/models";
import { getTodayDate } from "@/lib/date-utils";

type Tab = "today" | "manage";

interface HabitWithStatus extends Habit {
	completedToday: boolean;
	todayValue?: number;
	currentStreak: number;
	completionId?: string;
}

interface TodayResponse {
	date: string;
	habits: HabitWithStatus[];
}

function AdminHabitsPageContent() {
	const [tab, setTab] = useState<Tab>("today");
	const [date, setDate] = useState(getTodayDate());
	const [habits, setHabits] = useState<HabitWithStatus[]>([]);
	const [allHabits, setAllHabits] = useState<Habit[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
	const [showForm, setShowForm] = useState(false);

	// Load today's habits with status
	const loadTodayHabits = useCallback(async (selectedDate: string) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/habits/today?date=${selectedDate}`);
			const data: TodayResponse = await res.json();
			setHabits(data.habits);
		} catch (error) {
			console.error("Failed to load habits:", error);
			toast.error("Failed to load habits");
		} finally {
			setLoading(false);
		}
	}, []);

	// Load all habits for management
	const loadAllHabits = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/habits");
			const data: Habit[] = await res.json();
			setAllHabits(data);
		} catch (error) {
			console.error("Failed to load habits:", error);
			toast.error("Failed to load habits");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (tab === "today") {
			loadTodayHabits(date);
		} else {
			loadAllHabits();
		}
	}, [tab, date, loadTodayHabits, loadAllHabits]);

	// Handle toggling a boolean habit
	const handleToggle = async (habit: HabitWithStatus) => {
		if (habit.type === "auto") return;

		const newCompleted = !habit.completedToday;

		// Optimistic update
		setHabits((prev) =>
			prev.map((h) =>
				h.id === habit.id ? { ...h, completedToday: newCompleted } : h,
			),
		);

		try {
			const completion: Partial<HabitCompletion> = {
				id: habit.completionId || crypto.randomUUID(),
				habitId: habit.id,
				date,
				completed: newCompleted,
				createdAt: new Date().toISOString(),
			};

			await fetch("/api/habits/completions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(completion),
			});

			// Reload to get updated streaks
			await loadTodayHabits(date);
		} catch (error) {
			console.error("Failed to save completion:", error);
			toast.error("Failed to save");
			loadTodayHabits(date); // Revert on error
		}
	};

	// Handle changing count/duration value
	const handleValueChange = async (habit: HabitWithStatus, value: number) => {
		if (habit.type === "auto") return;

		// Optimistic update
		setHabits((prev) =>
			prev.map((h) =>
				h.id === habit.id
					? { ...h, todayValue: value, completedToday: value > 0 }
					: h,
			),
		);

		try {
			const completion: Partial<HabitCompletion> = {
				id: habit.completionId || crypto.randomUUID(),
				habitId: habit.id,
				date,
				completed: value > 0,
				value,
				createdAt: new Date().toISOString(),
			};

			await fetch("/api/habits/completions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(completion),
			});
		} catch (error) {
			console.error("Failed to save completion:", error);
			toast.error("Failed to save");
			loadTodayHabits(date);
		}
	};

	// Save a habit (create or update)
	const handleSaveHabit = async (habitData: Partial<Habit>) => {
		setSaving(true);
		try {
			await fetch("/api/habits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...habitData,
					id: habitData.id || crypto.randomUUID(),
				}),
			});

			toast.success(editingHabit ? "Habit updated!" : "Habit created!");
			setEditingHabit(null);
			setShowForm(false);
			loadAllHabits();
			if (tab === "today") loadTodayHabits(date);
		} catch (error) {
			console.error("Failed to save habit:", error);
			toast.error("Failed to save habit");
		} finally {
			setSaving(false);
		}
	};

	// Archive a habit
	const handleArchiveHabit = async (habit: Habit) => {
		if (
			!confirm(
				`Archive "${habit.name}"? It won't appear in your daily check-in.`,
			)
		)
			return;

		try {
			await fetch("/api/habits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...habit, archived: true }),
			});

			toast.success("Habit archived");
			loadAllHabits();
			if (tab === "today") loadTodayHabits(date);
		} catch (error) {
			console.error("Failed to archive habit:", error);
			toast.error("Failed to archive habit");
		}
	};

	// Date navigation
	const goToPreviousDay = () => {
		const prev = new Date(date);
		prev.setDate(prev.getDate() - 1);
		setDate(prev.toISOString().split("T")[0]);
	};

	const goToNextDay = () => {
		const next = new Date(date);
		next.setDate(next.getDate() + 1);
		const today = getTodayDate();
		if (next.toISOString().split("T")[0] <= today) {
			setDate(next.toISOString().split("T")[0]);
		}
	};

	const goToToday = () => {
		setDate(getTodayDate());
	};

	const isToday = date === getTodayDate();

	// Tab toggle component
	const TabToggle = () => (
		<div className="flex gap-2">
			{(["today", "manage"] as const).map((t) => (
				<button
					key={t}
					type="button"
					onClick={() => setTab(t)}
					className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
						tab === t
							? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
							: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
					}`}
				>
					{t === "today" ? "Today" : "Manage Habits"}
				</button>
			))}
		</div>
	);

	return (
		<AdminPageWrapper>
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<PageHeader
					title="Habits"
					description="Track your daily habits and build consistency."
				/>
				<div className="flex items-center gap-2">
					<Link
						href="/admin/habits/dashboard"
						className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
					>
						<BarChart3 className="w-4 h-4" />
						Dashboard
					</Link>
				</div>
			</div>

			<AdminSection>
				<div className="flex items-center justify-between mb-6">
					<TabToggle />

					{tab === "today" && (
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={goToPreviousDay}
								className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
							>
								<ChevronLeft size={20} />
							</button>
							<button
								type="button"
								onClick={goToToday}
								disabled={isToday}
								className={`px-3 py-1.5 text-sm rounded-lg ${
									isToday
										? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
										: "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
								}`}
							>
								{new Date(date).toLocaleDateString("en-US", {
									weekday: "short",
									month: "short",
									day: "numeric",
								})}
							</button>
							<button
								type="button"
								onClick={goToNextDay}
								disabled={isToday}
								className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
							>
								<ChevronRight size={20} />
							</button>
						</div>
					)}

					{tab === "manage" && (
						<button
							type="button"
							onClick={() => {
								setEditingHabit(null);
								setShowForm(true);
							}}
							className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						>
							<Plus size={16} />
							Add Habit
						</button>
					)}
				</div>

				{loading && (
					<p className="text-center text-zinc-500 py-8">Loading...</p>
				)}

				{/* Today Tab */}
				{!loading && tab === "today" && (
					<div className="space-y-3">
						{habits.length === 0 ? (
							<EmptyState message="No habits yet. Switch to 'Manage Habits' to create your first one!" />
						) : (
							habits.map((habit) => (
								<HabitCard
									key={habit.id}
									name={habit.name}
									emoji={habit.emoji}
									type={habit.type}
									valueType={habit.valueType}
									target={habit.target}
									completed={habit.completedToday}
									value={habit.todayValue}
									streak={habit.currentStreak}
									onToggle={() => handleToggle(habit)}
									onValueChange={(v) => handleValueChange(habit, v)}
								/>
							))
						)}
					</div>
				)}

				{/* Manage Tab */}
				{!loading && tab === "manage" && (
					<div className="space-y-6">
						{showForm && (
							<div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
								<SectionHeader
									title={editingHabit ? "Edit Habit" : "New Habit"}
								/>
								<HabitForm
									habit={editingHabit}
									saving={saving}
									onSave={handleSaveHabit}
									onCancel={() => {
										setEditingHabit(null);
										setShowForm(false);
									}}
								/>
							</div>
						)}

						<div className="space-y-2">
							<SectionHeader title="Your Habits" />
							{allHabits.length === 0 ? (
								<EmptyState message="No habits created yet. Click 'Add Habit' to get started!" />
							) : (
								<div className="space-y-2">
									{allHabits
										.filter((h) => !h.archived)
										.map((habit) => (
											<div
												key={habit.id}
												className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50"
											>
												<div className="flex items-center gap-3">
													<span className="text-xl">
														{habit.emoji || "📋"}
													</span>
													<div>
														<span className="font-medium">{habit.name}</span>
														<span className="ml-2 text-xs text-zinc-500">
															{habit.type === "auto"
																? `Auto: ${habit.autoSource}`
																: habit.valueType}
														</span>
													</div>
												</div>
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={() => {
															setEditingHabit(habit);
															setShowForm(true);
														}}
														className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
													>
														<Pencil size={16} />
													</button>
													<button
														type="button"
														onClick={() => handleArchiveHabit(habit)}
														className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
													>
														<Archive size={16} />
													</button>
												</div>
											</div>
										))}

									{/* Archived habits section */}
									{allHabits.some((h) => h.archived) && (
										<div className="mt-6">
											<h4 className="text-sm font-medium text-zinc-500 mb-2">
												Archived
											</h4>
											{allHabits
												.filter((h) => h.archived)
												.map((habit) => (
													<div
														key={habit.id}
														className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 opacity-60"
													>
														<div className="flex items-center gap-3">
															<span className="text-lg">
																{habit.emoji || "📋"}
															</span>
															<span>{habit.name}</span>
														</div>
													</div>
												))}
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				)}
			</AdminSection>
		</AdminPageWrapper>
	);
}

export default function AdminHabitsPage() {
	return (
		<Suspense
			fallback={
				<AdminPageWrapper>
					<PageHeader title="Habits" description="Loading..." />
				</AdminPageWrapper>
			}
		>
			<AdminHabitsPageContent />
		</Suspense>
	);
}
