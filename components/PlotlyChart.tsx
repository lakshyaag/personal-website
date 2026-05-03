"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { assetUrl } from "@/lib/assets";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type PlotlyTrace = Record<string, unknown>;
type PlotlyLayout = Record<string, unknown>;

type ThemeAnnotationStyle = { color: string; bgcolor: string };

type VariantFigure = {
	data: PlotlyTrace[];
	layout: PlotlyLayout;
};

type BaseChartJSON = {
	darkOverrides: PlotlyLayout;
	lightOverrides: PlotlyLayout;
	darkAnnotation: ThemeAnnotationStyle;
	lightAnnotation: ThemeAnnotationStyle;
};

type StaticChartJSON = BaseChartJSON & {
	data: PlotlyTrace[];
	layout: PlotlyLayout;
};

type InteractiveChartJSON = BaseChartJSON & {
	layout?: PlotlyLayout;
	variants: Record<string, VariantFigure>;
	defaultVariant?: string;
	variantOrder?: string[];
};

type ChartJSON = StaticChartJSON | InteractiveChartJSON;

type ChartControl = {
	type: "tabs" | "select";
	key: string;
};

interface PlotlyChartProps {
	/** Path to the chart JSON file (relative to public/) */
	src: string;
	/** Override chart height in px */
	height?: number;
	/** Additional CSS class on the wrapper div */
	className?: string;
	/** Optional UI controls for interactive chart variants */
	controls?: ChartControl[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...target };

	for (const key of Object.keys(source)) {
		const sourceValue = source[key];
		const targetValue = result[key];

		if (
			sourceValue &&
			targetValue &&
			typeof sourceValue === "object" &&
			typeof targetValue === "object" &&
			!Array.isArray(sourceValue) &&
			!Array.isArray(targetValue)
		) {
			result[key] = deepMerge(
				targetValue as Record<string, unknown>,
				sourceValue as Record<string, unknown>,
			);
			continue;
		}

		result[key] = sourceValue;
	}

	return result;
}

function isInteractiveChart(data: ChartJSON): data is InteractiveChartJSON {
	return "variants" in data;
}

function getVariantOrder(chartData: InteractiveChartJSON): string[] {
	if (chartData.variantOrder?.length) return chartData.variantOrder;
	return Object.keys(chartData.variants);
}

function getControlConfig(
	controls: ChartControl[] | undefined,
	variantCount: number,
): ChartControl {
	return (
		controls?.[0] ?? {
			type: variantCount <= 7 ? "tabs" : "select",
			key: "variant",
		}
	);
}

function applyAxisThemeOverrides(
	layout: PlotlyLayout,
	overrides: PlotlyLayout,
): PlotlyLayout {
	const nextLayout = { ...layout };
	const xAxisOverride = overrides.xaxis as PlotlyLayout | undefined;
	const yAxisOverride = overrides.yaxis as PlotlyLayout | undefined;

	for (const [key, value] of Object.entries(nextLayout)) {
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;

		if (xAxisOverride && /^xaxis\d+$/.test(key)) {
			nextLayout[key] = deepMerge(value as PlotlyLayout, xAxisOverride);
			continue;
		}

		if (yAxisOverride && /^yaxis\d+$/.test(key)) {
			nextLayout[key] = deepMerge(value as PlotlyLayout, yAxisOverride);
		}
	}

	return nextLayout;
}

function patchAnnotationTheme(
	layout: PlotlyLayout,
	annotationTheme: ThemeAnnotationStyle,
): PlotlyLayout {
	const nextLayout = { ...layout };

	if (Array.isArray(nextLayout.annotations)) {
		nextLayout.annotations = nextLayout.annotations.map((annotation) => {
			if (
				!annotation ||
				typeof annotation !== "object" ||
				Array.isArray(annotation)
			) {
				return annotation;
			}

			const currentAnnotation = annotation as PlotlyLayout;
			const existingFont =
				currentAnnotation.font && typeof currentAnnotation.font === "object"
					? (currentAnnotation.font as PlotlyLayout)
					: {};

			return {
				...currentAnnotation,
				font: {
					...existingFont,
					color: annotationTheme.color,
				},
				bgcolor: annotationTheme.bgcolor,
			};
		});
	}

	return nextLayout;
}

function buildThemedLayout(
	figure: VariantFigure,
	chartData: ChartJSON,
	isDark: boolean,
	height?: number,
): PlotlyLayout {
	const overrides = isDark ? chartData.darkOverrides : chartData.lightOverrides;
	const annotationTheme = isDark
		? chartData.darkAnnotation
		: chartData.lightAnnotation;

	let layout = deepMerge(figure.layout, overrides);
	layout = applyAxisThemeOverrides(layout, overrides);
	layout = patchAnnotationTheme(layout, annotationTheme);

	delete layout.width;
	layout.autosize = true;
	layout.transition = { duration: 300, easing: "cubic-in-out" };
	layout.paper_bgcolor = "rgba(0,0,0,0)";
	layout.plot_bgcolor = "rgba(0,0,0,0)";

	if (height) {
		layout.height = height;
	}

	return layout;
}

/** Singleton Plotly.js CDN loader */
let plotlyPromise: Promise<void> | null = null;

function loadPlotly(): Promise<void> {
	if ((window as any).Plotly) return Promise.resolve();
	if (plotlyPromise) return plotlyPromise;

	plotlyPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "https://cdn.plot.ly/plotly-3.0.1.min.js";
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load Plotly.js"));
		document.head.appendChild(script);
	});

	return plotlyPromise;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function PlotlyChart({
	src,
	height,
	className,
	controls,
}: PlotlyChartProps) {
	const chartRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);
	const [chartData, setChartData] = useState<ChartJSON | null>(null);
	const [activeVariant, setActiveVariant] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { resolvedTheme } = useTheme();

	const interactiveChartData = useMemo(
		() => (chartData && isInteractiveChart(chartData) ? chartData : null),
		[chartData],
	);
	const interactive = Boolean(interactiveChartData);
	const variantOrder = useMemo(
		() => (interactiveChartData ? getVariantOrder(interactiveChartData) : []),
		[interactiveChartData],
	);
	const control = useMemo(
		() => getControlConfig(controls, variantOrder.length),
		[controls, variantOrder.length],
	);

	const activeFigure = useMemo<VariantFigure | null>(() => {
		if (!chartData) return null;

		if (!isInteractiveChart(chartData)) {
			return {
				data: chartData.data,
				layout: chartData.layout,
			};
		}

		const selectedVariant =
			activeVariant && chartData.variants[activeVariant]
				? activeVariant
				: chartData.defaultVariant &&
						chartData.variants[chartData.defaultVariant]
					? chartData.defaultVariant
					: variantOrder[0];

		if (!selectedVariant) return null;

		const variant = chartData.variants[selectedVariant];
		const baseLayout = chartData.layout ?? {};

		return {
			data: variant.data,
			layout: deepMerge(baseLayout, variant.layout),
		};
	}, [chartData, activeVariant, variantOrder]);

	// Load Plotly + fetch chart data in parallel
	useEffect(() => {
		let cancelled = false;

		setReady(false);
		setError(null);
		setChartData(null);
		setActiveVariant(null);

		const resolvedSrc = assetUrl(src);
		if (!resolvedSrc) {
			setError("Chart source is missing.");
			return () => {
				cancelled = true;
			};
		}

		Promise.all([
			loadPlotly(),
			fetch(resolvedSrc).then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.json() as Promise<ChartJSON>;
			}),
		])
			.then(([, data]) => {
				if (cancelled) return;
				setChartData(data);

				if (isInteractiveChart(data)) {
					const initialVariant =
						data.defaultVariant && data.variants[data.defaultVariant]
							? data.defaultVariant
							: (getVariantOrder(data)[0] ?? null);
					setActiveVariant(initialVariant);
				}

				setReady(true);
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

	const render = useCallback(() => {
		if (!ready || !chartData || !chartRef.current || !activeFigure) return;

		const Plotly = (window as any).Plotly;
		if (!Plotly) return;

		const isDark = resolvedTheme === "dark";
		const layout = buildThemedLayout(activeFigure, chartData, isDark, height);

		Plotly.react(chartRef.current, activeFigure.data, layout, {
			displayModeBar: false,
			responsive: true,
		});
	}, [ready, chartData, activeFigure, resolvedTheme, height]);

	useEffect(() => {
		render();
	}, [render]);

	useEffect(() => {
		return () => {
			const Plotly = (window as any).Plotly;
			if (Plotly && chartRef.current) {
				Plotly.purge(chartRef.current);
			}
		};
	}, []);

	// Resize observer for responsive charts
	useEffect(() => {
		if (!ready || !chartRef.current) return;

		const Plotly = (window as any).Plotly;
		if (!Plotly) return;

		const resizeObserver = new ResizeObserver(() => {
			if (chartRef.current) {
				Plotly.Plots.resize(chartRef.current);
			}
		});

		resizeObserver.observe(chartRef.current);
		return () => resizeObserver.disconnect();
	}, [ready]);

	const showControls = interactive && variantOrder.length > 1;
	const minHeight = height ?? 500;

	// ── Render ─────────────────────────────────────────────────

	if (error) {
		return (
			<div
				className={`my-8 flex items-center justify-center rounded-xl border border-red-300 bg-red-50 p-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 ${className ?? ""}`}
			>
				Failed to load chart: {error}
			</div>
		);
	}

	return (
		<div
			className={`my-8 overflow-hidden rounded-xl border border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/30 ${className ?? ""}`}
		>
			{showControls && (
				<div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
					{control.type === "tabs" ? (
						<div
							role="tablist"
							aria-label={`Choose ${control.key}`}
							className="flex flex-wrap gap-2"
						>
							{variantOrder.map((variantKey) => {
								const isActive = variantKey === activeVariant;

								return (
									<button
										key={variantKey}
										type="button"
										role="tab"
										aria-selected={isActive}
										onClick={() => setActiveVariant(variantKey)}
										className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
											isActive
												? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
												: "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
										}`}
									>
										{variantKey}
									</button>
								);
							})}
						</div>
					) : (
						<label className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-300">
							<span className="font-medium capitalize">
								Choose {control.key}
							</span>
							<select
								value={activeVariant ?? ""}
								onChange={(event) => setActiveVariant(event.target.value)}
								className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
								aria-label={`Choose ${control.key}`}
							>
								{variantOrder.map((variantKey) => (
									<option key={variantKey} value={variantKey}>
										{variantKey}
									</option>
								))}
							</select>
						</label>
					)}
				</div>
			)}

			<div ref={chartRef} style={{ width: "100%", minHeight }} />

			{!ready && (
				<div className="flex items-center justify-center" style={{ minHeight }}>
					<div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
						<svg
							className="h-4 w-4 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						Loading chart…
					</div>
				</div>
			)}
		</div>
	);
}
