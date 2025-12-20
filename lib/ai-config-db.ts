/**
 * AI configuration database operations
 */

import { supabaseAdmin } from "./supabase-client";

export interface AIConfig {
    modelName: string;
    providerName: string;
}

const DEFAULT_CONFIG: AIConfig = {
    modelName: "openai/gpt-5.2",
    providerName: "prime-intellect",
};

/**
 * Get the current AI configuration from the database
 * Returns default values if not found
 */
export async function getAIConfig(): Promise<AIConfig> {
    const { data: modelData, error: modelError } = await supabaseAdmin
        .from("ai_config")
        .select("config_value")
        .eq("config_key", "model_name")
        .single();

    const { data: providerData, error: providerError } = await supabaseAdmin
        .from("ai_config")
        .select("config_value")
        .eq("config_key", "provider_name")
        .single();

    // If either config is missing, return defaults
    if (modelError || providerError) {
        console.warn(
            "AI config not found in database, using defaults:",
            modelError || providerError,
        );
        return DEFAULT_CONFIG;
    }

    return {
        modelName: modelData?.config_value || DEFAULT_CONFIG.modelName,
        providerName:
            providerData?.config_value || DEFAULT_CONFIG.providerName,
    };
}

/**
 * Update the AI configuration in the database
 */
export async function updateAIConfig(config: Partial<AIConfig>): Promise<void> {
    const updates: Array<{ config_key: string; config_value: string }> = [];

    if (config.modelName !== undefined) {
        updates.push({
            config_key: "model_name",
            config_value: config.modelName,
        });
    }

    if (config.providerName !== undefined) {
        updates.push({
            config_key: "provider_name",
            config_value: config.providerName,
        });
    }

    if (updates.length === 0) {
        return;
    }

    // Use upsert to insert or update
    for (const update of updates) {
        const { error } = await supabaseAdmin
            .from("ai_config")
            .upsert(
                {
                    config_key: update.config_key,
                    config_value: update.config_value,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "config_key",
                },
            );

        if (error) {
            console.error("Error updating AI config:", error);
            throw error;
        }
    }
}

