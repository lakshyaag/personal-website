"use client";

import { useState, useEffect } from "react";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormActions } from "@/components/admin/FormActions";
import { toast } from "sonner";
import { Settings, Loader2 } from "lucide-react";
import primeModelsJson from "@/data/prime-models-simple.json";

const PRIME_MODEL_IDS = (primeModelsJson as string[]).sort((a, b) =>
	a.localeCompare(b),
);

interface AIConfig {
	modelName: string;
	providerName: string;
}

export default function AIConfigPage() {
	const [config, setConfig] = useState<AIConfig>({
		modelName: "",
		providerName: "",
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		loadConfig();
	}, []);

	async function loadConfig() {
		try {
			setIsLoading(true);
			const response = await fetch("/api/ai/config");
			if (!response.ok) {
				throw new Error("Failed to load configuration");
			}
			const data = await response.json();
			setConfig(data);
		} catch (error) {
			console.error("Error loading config:", error);
			toast.error("Failed to load AI configuration");
		} finally {
			setIsLoading(false);
		}
	}

	async function handleSave() {
		try {
			setIsSaving(true);
			const response = await fetch("/api/ai/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(config),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to save configuration");
			}

			const updatedConfig = await response.json();
			setConfig(updatedConfig);
			toast.success("AI configuration saved successfully");
		} catch (error) {
			console.error("Error saving config:", error);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to save AI configuration",
			);
		} finally {
			setIsSaving(false);
		}
	}

	if (isLoading) {
		return (
			<AdminPageWrapper>
				<div className="flex items-center justify-center py-12">
					<Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
				</div>
			</AdminPageWrapper>
		);
	}

	return (
		<AdminPageWrapper>
			<PageHeader
				title="AI Configuration"
				description="Configure the AI model and provider used for food analysis"
			/>

			<AdminSection>
				<div className="space-y-6">
					<div className="flex items-center gap-2 mb-4">
						<Settings className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
							Settings
						</h2>
					</div>

					<div className="space-y-4">
						<div>
							<label
								htmlFor="providerName"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
							>
								Provider Name
							</label>
							<input
								id="providerName"
								type="text"
								value={config.providerName}
								onChange={(e) =>
									setConfig({ ...config, providerName: e.target.value })
								}
								className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
								placeholder="e.g., prime-intellect"
							/>
							<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
								The name of the AI provider (must match the provider name in
								your AI SDK configuration)
							</p>
						</div>

						<div>
							<label
								htmlFor="modelName"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
							>
								Model Name
							</label>
							<select
								id="modelName"
								value={config.modelName}
								onChange={(e) =>
									setConfig({ ...config, modelName: e.target.value })
								}
								className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
							>
								<option value="" disabled>
									Select a model…
								</option>
								{config.modelName &&
								!PRIME_MODEL_IDS.includes(config.modelName) ? (
									<option value={config.modelName}>
										{config.modelName} (current)
									</option>
								) : null}
								{PRIME_MODEL_IDS.map((modelId) => (
									<option key={modelId} value={modelId}>
										{modelId}
									</option>
								))}
							</select>
							<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
								Select from the Prime Intellect model list.
							</p>
						</div>
					</div>

					<FormActions
						onSave={handleSave}
						onCancel={() => loadConfig()}
						saving={isSaving}
						saveLabel="Save Configuration"
					/>
				</div>
			</AdminSection>
		</AdminPageWrapper>
	);
}
