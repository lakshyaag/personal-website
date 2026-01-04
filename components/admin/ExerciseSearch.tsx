"use client";

import { searchExercises, type ExerciseDefinition } from "@/lib/exercises";
import { Search, X } from "lucide-react";
import { useState } from "react";

interface ExerciseSearchProps {
	onSelect: (exercise: ExerciseDefinition) => void;
	placeholder?: string;
}

export function ExerciseSearch({
	onSelect,
	placeholder = "Search exercises...",
}: ExerciseSearchProps) {
	const [query, setQuery] = useState("");
	
	const showDropdown = query.length > 1;
	const results = showDropdown ? searchExercises(query) : [];

	const handleSearch = (val: string) => {
		setQuery(val);
	};

	const handleSelect = (ex: ExerciseDefinition) => {
		onSelect(ex);
		setQuery("");
	};

	const handleClear = () => {
		setQuery("");
	};

	return (
		<div className="relative w-full">
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
				<input
					type="text"
					value={query}
					onChange={(e) => handleSearch(e.target.value)}
					placeholder={placeholder}
					className="w-full pl-10 pr-10 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-500"
				/>
				{query && (
					<button
						type="button"
						onClick={handleClear}
						className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
						aria-label="Clear search"
					>
						<X className="w-4 h-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
					</button>
				)}
			</div>

			{showDropdown && results.length > 0 && (
				<div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-black/20">
					{results.map((ex) => (
						<button
							key={ex.id}
							type="button"
							onClick={() => handleSelect(ex)}
							className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b last:border-0 border-zinc-100 dark:border-zinc-700"
						>
							<div className="font-medium text-zinc-900 dark:text-zinc-100">
								{ex.canonicalName}
							</div>
							<div className="text-xs text-zinc-500 dark:text-zinc-400 flex gap-2 mt-1">
								<span className="capitalize">{ex.category}</span>
								<span>•</span>
								<span>{ex.primaryMuscles.join(", ")}</span>
							</div>
						</button>
					))}
				</div>
			)}

			{showDropdown && results.length === 0 && (
				<div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
					No exercises found
				</div>
			)}
		</div>
	);
}
