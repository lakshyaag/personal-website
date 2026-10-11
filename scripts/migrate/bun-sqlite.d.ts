// The slice of Bun's built-in SQLite that d1.ts uses for local rehearsals (no bun-types here).
declare module "bun:sqlite" {
	type Param = string | number | null;
	interface Statement {
		all(...params: Param[]): unknown[];
		get(...params: Param[]): unknown;
		run(...params: Param[]): unknown;
	}
	export class Database {
		constructor(path: string);
		query(sql: string): Statement;
		transaction(fn: () => void): () => void;
	}
}
