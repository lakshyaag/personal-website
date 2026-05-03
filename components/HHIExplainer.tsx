"use client";

import { useEffect, useMemo, useState } from "react";
import { assetUrl } from "@/lib/assets";

type ExplainerPreset = {
	label?: string;
	description?: string;
	shares: number[];
	labels: string[];
};

type ExplainerJSON = {
	presets: Record<string, ExplainerPreset>;
};

type PresetMeta = {
	key: string;
	fallbackLabel: string;
	fallbackDescription: string;
};

const PRESET_ORDER: PresetMeta[] = [
	{
		key: "equal",
		fallbackLabel: "Equal split",
		fallbackDescription:
			"Five equal partners. Maximum diversification for this widget.",
	},
	{
		key: "dominant",
		fallbackLabel: "One dominant",
		fallbackDescription:
			"One oversized partner pushes the effective number down fast.",
	},
	{
		key: "india_fy25",
		fallbackLabel: "India FY25",
		fallbackDescription:
			"India's top-five export partners, rescaled to 100% for the demo.",
	},
];

const BAR_COLORS = [
	"#FF9933",
	"#2EC4B6",
	"#457B9D",
	"#FCBF49",
	"#E63946",
	"#7B2D8E",
];

interface HHIExplainerProps {
	src: string;
	className?: string;
}

function roundTo(value: number, digits = 1) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function normalizeShares(shares: number[]): number[] {
	const total = shares.reduce((sum, value) => sum + value, 0);

	if (total <= 0) {
		return Array.from({ length: shares.length }, () =>
			roundTo(100 / shares.length),
		);
	}

	const normalized = shares.map((value) => (value / total) * 100);
	const rounded = normalized.map((value) => roundTo(value));
	const roundedTotal = rounded.reduce((sum, value) => sum + value, 0);
	const drift = roundTo(100 - roundedTotal);

	if (rounded.length > 0) {
		rounded[0] = roundTo(rounded[0] + drift);
	}

	return rounded;
}

function rebalanceShares(
	shares: number[],
	index: number,
	nextValue: number,
): number[] {
	const clamped = Math.max(0, Math.min(100, nextValue));
	const current = [...shares];
	const others = current.filter((_, currentIndex) => currentIndex !== index);
	const othersTotal = others.reduce((sum, value) => sum + value, 0);
	const remaining = Math.max(0, 100 - clamped);

	const nextShares = current.map((value, currentIndex) => {
		if (currentIndex === index) return clamped;

		if (othersTotal <= 0) {
			const slots = current.length - 1;
			return slots > 0 ? remaining / slots : 0;
		}

		return (value / othersTotal) * remaining;
	});

	return normalizeShares(nextShares);
}

function formatFormula(shares: number[]): string {
	return shares.map((share) => `${(share / 100).toFixed(2)}²`).join(" + ");
}

export function HHIExplainer({ src, className }: HHIExplainerProps) {
	const [data, setData] = useState<ExplainerJSON | null>(null);
	const [activePresetKey, setActivePresetKey] = useState<string | null>(null);
	const [labels, setLabels] = useState<string[]>([]);
	const [shares, setShares] = useState<number[]>([]);
	const [presetTotal, setPresetTotal] = useState<number>(100);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		setData(null);
		setError(null);
		setActivePresetKey(null);
		setLabels([]);
		setShares([]);
		setPresetTotal(100);

		const resolvedSrc = assetUrl(src);
		if (!resolvedSrc) {
			setError("Explainer source is missing.");
			return () => {
				cancelled = true;
			};
		}

		fetch(resolvedSrc)
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.json() as Promise<ExplainerJSON>;
			})
			.then((payload) => {
				if (cancelled) return;

				setData(payload);

				const initialKey =
					PRESET_ORDER.find((preset) => payload.presets[preset.key])?.key ??
					Object.keys(payload.presets)[0] ??
					null;

				if (!initialKey) return;

				const preset = payload.presets[initialKey];
				setActivePresetKey(initialKey);
				setLabels(preset.labels);
				setPresetTotal(
					roundTo(
						preset.shares.reduce((sum, value) => sum + value, 0),
						1,
					),
				);
				setShares(normalizeShares(preset.shares));
			})
			.catch((fetchError: Error) => {
				if (!cancelled) {
					setError(fetchError.message);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [src]);

	const activePreset =
		activePresetKey && data ? data.presets[activePresetKey] : null;
	const hhi = useMemo(
		() => shares.reduce((sum, share) => sum + (share / 100) ** 2, 0),
		[shares],
	);
	const effectiveNumber = hhi > 0 ? 1 / hhi : 0;
	const equalShare = shares.length > 0 ? 100 / shares.length : 0;
	const normalizedNoteNeeded = Math.abs(presetTotal - 100) > 0.1;

	const applyPreset = (presetKey: string) => {
		if (!data) return;

		const preset = data.presets[presetKey];
		if (!preset) return;

		setActivePresetKey(presetKey);
		setLabels(preset.labels);
		setPresetTotal(
			roundTo(
				preset.shares.reduce((sum, value) => sum + value, 0),
				1,
			),
		);
		setShares(normalizeShares(preset.shares));
	};

	if (error) {
		return (
			<div
				className={`my-8 rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 ${className ?? ""}`}
			>
				Failed to load HHI explainer: {error}
			</div>
		);
	}

	if (!data || !shares.length) {
		return (
			<div
				className={`my-8 flex min-h-[420px] items-center justify-center rounded-xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400 ${className ?? ""}`}
			>
				Loading explainer…
			</div>
		);
	}

	return (
		<div
			className={`my-8 overflow-hidden rounded-xl border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/30 ${className ?? ""}`}
		>
			<div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
				<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
					HHI explainer
				</h3>
				<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
					Drag the shares. More equal = higher effective number.
				</p>
			</div>

			<div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_320px]">
				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						{PRESET_ORDER.filter((preset) => data.presets[preset.key]).map(
							(preset) => {
								const payload = data.presets[preset.key];
								const isActive = preset.key === activePresetKey;

								return (
									<button
										key={preset.key}
										type="button"
										onClick={() => applyPreset(preset.key)}
										className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
											isActive
												? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
												: "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
										}`}
									>
										{payload.label ?? preset.fallbackLabel}
									</button>
								);
							},
						)}
					</div>

					{normalizedNoteNeeded && (
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							{activePreset?.label ?? "This preset"} sums to{" "}
							{presetTotal.toFixed(1)}% in the source data, so it is rescaled to
							100% here.
						</p>
					)}

					<div className="space-y-4">
						{shares.map((share, index) => {
							const label = labels[index] ?? `Partner ${index + 1}`;
							const color = BAR_COLORS[index % BAR_COLORS.length];

							return (
								<div key={`${label}-${index}`} className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{ backgroundColor: color }}
												aria-hidden="true"
											/>
											<span>{label}</span>
										</div>
										<span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
											{share.toFixed(1)}%
										</span>
									</div>

									<div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
										<div
											className="h-full rounded-full transition-[width] duration-300"
											style={{ width: `${share}%`, backgroundColor: color }}
										/>
									</div>

									<input
										type="range"
										min={0}
										max={100}
										step={0.5}
										value={share}
										onChange={(event) => {
											const nextValue = Number(event.target.value);
											setShares((currentShares) =>
												rebalanceShares(currentShares, index, nextValue),
											);
										}}
										className="w-full"
										style={{ accentColor: color }}
										aria-label={`Adjust ${label} share`}
									/>
								</div>
							);
						})}
					</div>
				</div>

				<div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
					<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
						<p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
							Effective number
						</p>
						<p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
							{effectiveNumber.toFixed(1)}
						</p>
						<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
							As if exports were split equally across{" "}
							{effectiveNumber.toFixed(1)} partners.
						</p>
					</div>

					<div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
						<p>
							Equal split benchmark: {shares.length} partners ×{" "}
							{equalShare.toFixed(1)}% each → effective number = {shares.length}
							.
						</p>
						<p className="mt-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
							{formatFormula(shares)} = {hhi.toFixed(3)}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
