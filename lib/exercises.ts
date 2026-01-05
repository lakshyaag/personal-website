import exercises from "../data/exercises.json";

export interface ExerciseDefinition {
	id: string;
	canonicalName: string;
	aliases: string[];
	category: "compound" | "isolation" | "cardio" | "core" | "other";
	primaryMuscles: string[];
}

/**
 * Normalizes an exercise name to its canonical form using the exercise dictionary.
 * If no match is found, returns the original name in Title Case.
 */
export function normalizeExerciseName(name: string): string {
	const lowerName = name.toLowerCase().trim();

	// 1. Direct match with canonical name or aliases
	for (const ex of exercises as ExerciseDefinition[]) {
		if (
			ex.canonicalName.toLowerCase() === lowerName ||
			ex.aliases.some((alias) => alias.toLowerCase() === lowerName)
		) {
			return ex.canonicalName;
		}
	}

	// 2. Fuzzy/partial match (optional: can be expanded)
	// For now, just return Title Case if no match
	return name
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/**
 * Returns the exercise definition if a match is found.
 */
export function getExerciseDefinition(name: string): ExerciseDefinition | null {
	const lowerName = name.toLowerCase().trim();
	return (
		(exercises as ExerciseDefinition[]).find(
			(ex) =>
				ex.canonicalName.toLowerCase() === lowerName ||
				ex.aliases.some((alias) => alias.toLowerCase() === lowerName),
		) || null
	);
}

/**
 * Searches the dictionary for exercises matching a query.
 */
export function searchExercises(query: string): ExerciseDefinition[] {
	const lowerQuery = query.toLowerCase().trim();
	if (!lowerQuery) return [];

	return (exercises as ExerciseDefinition[]).filter(
		(ex) =>
			ex.canonicalName.toLowerCase().includes(lowerQuery) ||
			ex.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery)),
	);
}

export function getAllCanonicalNames(): string[] {
	return (exercises as ExerciseDefinition[]).map((ex) => ex.canonicalName);
}
