"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Sparkles, X, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { FoodEntry } from "@/lib/models";
import { resolvePhotoUrl } from "@/hooks/usePhotoUrl";

interface FoodAnalysisResult {
	foodName: string;
	calories: number;
	proteinG: number;
	carbsG: number;
	fatG: number;
	notes: string;
	metadataId: string;
}

interface FoodAnalysisModalProps {
	entry: FoodEntry | null;
	onClose: () => void;
	onAnalysisComplete?: () => void;
}

export function FoodAnalysisModal({
	entry,
	onClose,
	onAnalysisComplete,
}: FoodAnalysisModalProps) {
	const [analysisResult, setAnalysisResult] =
		useState<FoodAnalysisResult | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	// Track if the current result came from a fresh analysis (not from existing data)
	const [justAnalyzed, setJustAnalyzed] = useState(false);

	// Track the entry id to detect when entry changes
	const prevEntryIdRef = useRef<string | null>(null);

	// Check if entry has existing analysis
	const hasExistingAnalysis = useMemo(() => {
		return !!(entry?.aiFoodName && entry.aiCalories !== undefined);
	}, [entry]);

	// Convert existing entry data to analysis result format
	const existingAnalysis = useMemo<FoodAnalysisResult | null>(() => {
		if (!hasExistingAnalysis || !entry) return null;
		return {
			foodName: entry.aiFoodName ?? "",
			calories: entry.aiCalories ?? 0,
			proteinG: entry.aiProteinG ?? 0,
			carbsG: entry.aiCarbsG ?? 0,
			fatG: entry.aiFatG ?? 0,
			notes: entry.aiNotes ?? "",
			metadataId: entry.aiMetadataId ?? "",
		};
	}, [hasExistingAnalysis, entry]);

	// Reset state when entry changes
	useEffect(() => {
		if (entry && entry.id !== prevEntryIdRef.current) {
			prevEntryIdRef.current = entry.id;
			setAnalysisResult(null);
			setIsAnalyzing(false);
			setJustAnalyzed(false);

			// Auto-analyze only if no existing analysis
			if (!hasExistingAnalysis) {
				analyzeEntry(entry);
			}
		}
	}, [entry, hasExistingAnalysis]);

	async function analyzeEntry(entryToAnalyze: FoodEntry) {
		if (
			!entryToAnalyze.description &&
			(!entryToAnalyze.photos || entryToAnalyze.photos.length === 0)
		) {
			toast.error("This entry has no content to analyze");
			onClose();
			return;
		}

		setIsAnalyzing(true);
		setAnalysisResult(null);
		setJustAnalyzed(false);

		try {
			// Resolve sb:// URLs to signed URLs before sending to API
			const resolvedPhotos = entryToAnalyze.photos
				? await Promise.all(
						entryToAnalyze.photos.map((photo) =>
							resolvePhotoUrl(photo),
						),
					)
				: [];

			const response = await fetch("/api/food/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					entryId: entryToAnalyze.id,
					description: entryToAnalyze.description,
					photos: resolvedPhotos,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to analyze entry");
			}

			const result: FoodAnalysisResult = await response.json();
			setAnalysisResult(result);
			setJustAnalyzed(true);

			// Trigger callback to reload entries
			if (onAnalysisComplete) {
				onAnalysisComplete();
			}
		} catch (error) {
			console.error("Analysis error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to analyze food entry",
			);
			// Don't close on error if we had existing analysis - let user see the error
			if (!hasExistingAnalysis) {
				onClose();
			}
		} finally {
			setIsAnalyzing(false);
		}
	}

	function handleReAnalyze() {
		if (entry) {
			analyzeEntry(entry);
		}
	}

	if (!entry) return null;

	// Determine what to display
	const displayResult = analysisResult || existingAnalysis;
	// We're showing existing if: has existing analysis, not currently analyzing, and haven't just done a fresh analysis
	const isShowingExisting =
		hasExistingAnalysis && !isAnalyzing && !justAnalyzed;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-2xl">
				<div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
					<div className="flex items-center gap-2">
						<Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
							AI Nutritional Analysis
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
					>
						<X className="w-5 h-5 text-zinc-500" />
					</button>
				</div>

				<div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-140px)]">
					{/* Entry Summary */}
					<div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							<span className="font-medium">Entry:</span>{" "}
							{entry.description || "Photo(s) only"}
						</p>
						{entry.photos && entry.photos.length > 0 && (
							<p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
								{entry.photos.length} photo(s) included
							</p>
						)}
					</div>

					{/* Loading State */}
					{isAnalyzing && (
						<div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
							<div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
							<span>Analyzing your food entry...</span>
						</div>
					)}

					{/* Analysis Result */}
					{displayResult && !isAnalyzing && (
						<div className="space-y-4">
							{/* Food Name */}
							<div>
								<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
									{displayResult.foodName}
								</h3>
							</div>

							{/* Nutrition Grid */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
								<div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
									<div className="text-2xl font-bold text-green-700 dark:text-green-400">
										{displayResult.calories}
									</div>
									<div className="text-xs text-green-600 dark:text-green-500">
										Calories
									</div>
								</div>
								<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
									<div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
										{displayResult.proteinG}g
									</div>
									<div className="text-xs text-blue-600 dark:text-blue-500">
										Protein
									</div>
								</div>
								<div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
									<div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
										{displayResult.carbsG}g
									</div>
									<div className="text-xs text-amber-600 dark:text-amber-500">
										Carbs
									</div>
								</div>
								<div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-center">
									<div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
										{displayResult.fatG}g
									</div>
									<div className="text-xs text-rose-600 dark:text-rose-500">
										Fat
									</div>
								</div>
							</div>

							{/* Notes */}
							<div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
								<h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									Notes
								</h4>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									{displayResult.notes}
								</p>
							</div>
						</div>
					)}
				</div>

				<div className="border-t border-zinc-200 dark:border-zinc-700 px-6 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						{displayResult && !isAnalyzing && (
							<span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
								<Check className="w-4 h-4" />
								{justAnalyzed ? "Saved to entry" : "Saved"}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2 ml-auto">
						{displayResult && !isAnalyzing && (
							<button
								type="button"
								onClick={handleReAnalyze}
								disabled={isAnalyzing}
								className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
							>
								<RefreshCw className="w-4 h-4" />
								Re-analyze
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-colors"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
