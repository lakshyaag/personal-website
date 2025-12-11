/**
 * Generic database operations factory for Supabase
 * Provides CRUD operations with consistent patterns
 */

import { supabaseAdmin } from "./supabase-client";

interface OrderByConfig {
    column: string;
    ascending: boolean;
}

interface DbOperationsConfig<T, DbRow, DbRowWrite = Partial<DbRow>> {
    /** The Supabase table name */
    table: string;
    /** Column name for date-based filtering (e.g., "entry_date", "log_date") */
    dateColumn?: string;
    /** Ordering configuration */
    orderBy?: OrderByConfig[];
    /** Transform function from DB row to app model */
    transformFromDb: (row: DbRow) => T;
    /** Transform function from app model to DB row (may omit auto-generated fields like created_at) */
    transformToDb: (item: T) => DbRowWrite;
}

interface DbOperations<T> {
    /** Get all items, ordered as configured */
    getAll: () => Promise<T[]>;
    /** Get a single item by ID */
    getById: (id: string) => Promise<T | null>;
    /** Create or update an item (upsert) */
    save: (item: T) => Promise<string>;
    /** Delete an item by ID */
    deleteById: (id: string) => Promise<void>;
}

interface DbOperationsWithDate<T> extends DbOperations<T> {
    /** Get items for a specific date */
    getByDate: (date: string) => Promise<T[]>;
    /** Get items grouped by date */
    getGroupedByDate: () => Promise<Record<string, T[]>>;
}

/**
 * Creates a set of database operations for a given table and configuration
 */
export function createDbOperations<
    T extends { date?: string },
    DbRow,
    DbRowWrite = Partial<DbRow>,
>(
    config: DbOperationsConfig<T, DbRow, DbRowWrite> & { dateColumn: string },
): DbOperationsWithDate<T>;
export function createDbOperations<T, DbRow, DbRowWrite = Partial<DbRow>>(
    config: DbOperationsConfig<T, DbRow, DbRowWrite>,
): DbOperations<T>;
export function createDbOperations<
    T extends { date?: string },
    DbRow,
    DbRowWrite = Partial<DbRow>,
>(
    config: DbOperationsConfig<T, DbRow, DbRowWrite>,
): DbOperations<T> | DbOperationsWithDate<T> {
    const { table, dateColumn, orderBy = [], transformFromDb, transformToDb } =
        config;

    async function getAll(): Promise<T[]> {
        let query = supabaseAdmin.from(table).select("*");

        // Apply ordering
        for (const order of orderBy) {
            query = query.order(order.column, { ascending: order.ascending });
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Error fetching from ${table}:`, error);
            throw error;
        }

        return (data as DbRow[]).map(transformFromDb);
    }

    async function getById(id: string): Promise<T | null> {
        const { data, error } = await supabaseAdmin
            .from(table)
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                // No rows returned
                return null;
            }
            console.error(`Error fetching ${table} by ID:`, error);
            throw error;
        }

        return transformFromDb(data as DbRow);
    }

    async function save(item: T): Promise<string> {
        const dbItem = transformToDb(item);

        const { data, error } = await supabaseAdmin
            .from(table)
            .upsert(dbItem)
            .select("id")
            .single();

        if (error) {
            console.error(`Error saving to ${table}:`, error);
            throw error;
        }

        return data.id;
    }

    async function deleteById(id: string): Promise<void> {
        const { error } = await supabaseAdmin.from(table).delete().eq("id", id);

        if (error) {
            console.error(`Error deleting from ${table}:`, error);
            throw error;
        }
    }

    const baseOps: DbOperations<T> = {
        getAll,
        getById,
        save,
        deleteById,
    };

    // If dateColumn is provided, add date-specific operations
    if (dateColumn) {
        const dateCol = dateColumn; // Narrow type for closure
        async function getByDate(date: string): Promise<T[]> {
            let query = supabaseAdmin
                .from(table)
                .select("*")
                .eq(dateCol, date);

            // Apply ordering (excluding the date column since we're filtering by it)
            for (const order of orderBy) {
                if (order.column !== dateCol) {
                    query = query.order(order.column, { ascending: order.ascending });
                }
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Error fetching ${table} by date:`, error);
                throw error;
            }

            return (data as DbRow[]).map(transformFromDb);
        }

        async function getGroupedByDate(): Promise<Record<string, T[]>> {
            const items = await getAll();

            const grouped: Record<string, T[]> = {};
            for (const item of items) {
                const dateValue = (item as T & { date?: string }).date;
                if (dateValue) {
                    if (!grouped[dateValue]) {
                        grouped[dateValue] = [];
                    }
                    grouped[dateValue].push(item);
                }
            }

            return grouped;
        }

        return {
            ...baseOps,
            getByDate,
            getGroupedByDate,
        } as DbOperationsWithDate<T>;
    }

    return baseOps;
}

