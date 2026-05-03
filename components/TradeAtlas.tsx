"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { assetUrl } from "@/lib/assets";

type PlotlyTrace = Record<string, unknown>;
type PlotlyLayout = Record<string, unknown>;

type ThemeAnnotationStyle = { color: string; bgcolor: string };

type VariantFigure = {
	data: PlotlyTrace[];
	layout: PlotlyLayout;
};

type AtlasCountrySummary = {
	iso: string;
	name: string;
	rawCountry: string;
	exports: number;
	imports: number;
	balance: number;
	tradeShare: number;
	deficitRank: number | null;
	surplusRank: number | null;
	topImports: Array<{ label: string; fullLabel?: string; value: number }>;
	topExports: Array<{ label: string; fullLabel?: string; value: number }>;
};

type AtlasYear = {
	map: VariantFigure;
	countries: Record<string, AtlasCountrySummary>;
};

type AtlasCountryHistory = {
	iso: string;
	name: string;
	rawCountry: string;
	years: string[];
	exports: number[];
	imports: number[];
	balance: number[];
};

type AtlasJSON = {
	years: Record<string, AtlasYear>;
	countryHistory: Record<string, AtlasCountryHistory>;
	defaultYear: string;
	yearOrder: string[];
	darkOverrides: PlotlyLayout;
	lightOverrides: PlotlyLayout;
	darkAnnotation: ThemeAnnotationStyle;
	lightAnnotation: ThemeAnnotationStyle;
};

const ATLAS_FONT_FAMILY =
	'var(--font-geist), "Geist", "Inter", "SF Pro Display", "Segoe UI", sans-serif';

interface TradeAtlasProps {
	src: string;
	className?: string;
}

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

function applyAxisThemeOverrides(
	layout: PlotlyLayout,
	overrides: PlotlyLayout,
): PlotlyLayout {
	const nextLayout = { ...layout };
	const xAxisOverride = overrides.xaxis as PlotlyLayout | undefined;
	const yAxisOverride = overrides.yaxis as PlotlyLayout | undefined;

	for (const [key, value] of Object.entries(nextLayout)) {
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;

		if (xAxisOverride && /^xaxis\d*$/.test(key)) {
			nextLayout[key] = deepMerge(value as PlotlyLayout, xAxisOverride);
			continue;
		}

		if (yAxisOverride && /^yaxis\d*$/.test(key)) {
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
	chartData: AtlasJSON,
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
	layout = deepMerge(layout, {
		font: {
			family: ATLAS_FONT_FAMILY,
			size: 12,
		},
		title: {
			x: 0.02,
			xanchor: "left",
			font: {
				family: ATLAS_FONT_FAMILY,
				size: 18,
				color: isDark ? "#fafafa" : "#18181b",
			},
			subtitle: {
				font: {
					family: ATLAS_FONT_FAMILY,
					size: 12,
					color: isDark ? "#a1a1aa" : "#71717a",
				},
			},
		},
		hoverlabel: {
			align: "left",
			font: {
				family: ATLAS_FONT_FAMILY,
				size: 12,
			},
		},
		legend: {
			font: {
				family: ATLAS_FONT_FAMILY,
			},
		},
		margin: {
			t: 88,
			l: 28,
			r: 24,
			b: 28,
		},
		geo: {
			bgcolor: "rgba(0,0,0,0)",
			showcoastlines: true,
			coastlinecolor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
			countrycolor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
			landcolor: isDark ? "#18181b" : "#fafafa",
			oceancolor: "rgba(0,0,0,0)",
			lakecolor: "rgba(0,0,0,0)",
		},
		xaxis: {
			gridcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(24,24,27,0.06)",
			zerolinecolor: isDark ? "rgba(255,255,255,0.14)" : "rgba(24,24,27,0.12)",
		},
		yaxis: {
			gridcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(24,24,27,0.06)",
			zerolinecolor: isDark ? "rgba(255,255,255,0.14)" : "rgba(24,24,27,0.12)",
		},
	});

	layout.autosize = true;
	layout.transition = { duration: 250, easing: "cubic-in-out" };
	layout.paper_bgcolor = "rgba(0,0,0,0)";
	layout.plot_bgcolor = "rgba(0,0,0,0)";
	layout.dragmode = false;
	layout.hovermode = "closest";

	if (height) {
		layout.height = height;
	}

	return layout;
}

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

function formatBillions(value: number, digits = 1) {
	return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(digits)}B`;
}

function createBalanceFigure(
	history: AtlasCountryHistory,
	selectedYear: string,
): VariantFigure {
	const selectedIndex = history.years.indexOf(selectedYear);
	const minBalance = Math.min(...history.balance, 0);
	const colors = history.balance.map((value, index) => {
		if (index === selectedIndex) return "#FCBF49";
		return value >= 0 ? "#06D6A0" : "#E63946";
	});

	return {
		data: [
			{
				type: "bar",
				x: history.years,
				y: history.balance,
				customdata: history.years.map((_, index) => [
					history.exports[index],
					history.imports[index],
				]),
				marker: { color: colors },
				text: history.balance.map((value) => formatBillions(value, 0)),
				textposition: "outside",
				cliponaxis: false,
				hovertemplate:
					"%{x}<br>Balance: %{y:+.1f}B<br>Exports: %{customdata[0]:.1f}B<br>Imports: %{customdata[1]:.1f}B<extra></extra>",
				showlegend: false,
			},
		],
		layout: {
			title: {
				text: `${history.name}: bilateral balance over time`,
				subtitle: {
					text: "Selected year highlighted in gold",
				},
			},
			xaxis: { type: "category" },
			yaxis: {
				tickprefix: "$",
				ticksuffix: "B",
				tickformat: "+.0f",
				zeroline: true,
				zerolinewidth: 2,
				range: [minBalance * 1.18, 2],
			},
			margin: { l: 48, r: 18, t: 86, b: 42 },
			height: 320,
		},
	};
}

function createCategoryFigure(
	title: string,
	items: Array<{ label: string; fullLabel?: string; value: number }>,
	color: string,
): VariantFigure {
	const sorted = [...items].sort((a, b) => b.value - a.value);

	return {
		data: [
			{
				type: "bar",
				orientation: "h",
				y: sorted.map((item) => item.label),
				x: sorted.map((item) => item.value),
				customdata: sorted.map((item) => item.fullLabel ?? item.label),
				marker: { color, line: { width: 0 } },
				text: sorted.map((item) => `$${item.value.toFixed(1)}B`),
				textposition: "outside",
				cliponaxis: false,
				hovertemplate:
					"<b>%{customdata}</b><br>Value: $%{x:.1f}B<extra></extra>",
				showlegend: false,
			},
		],
		layout: {
			title: {
				text: title,
				subtitle: {
					text: "Top HS4 products in the selected year",
				},
			},
			xaxis: {
				tickprefix: "$",
				ticksuffix: "B",
				tickformat: ".1f",
			},
			yaxis: {
				automargin: true,
				autorange: "reversed",
				tickfont: { size: 11 },
			},
			margin: { l: 188, r: 56, t: 86, b: 26 },
			height: 300,
		},
	};
}

function createEmptyCategoryFigure(title: string): VariantFigure {
	return {
		data: [],
		layout: {
			title: { text: title },
			annotations: [
				{
					text: "No material trade in the selected year",
					xref: "paper",
					yref: "paper",
					x: 0.5,
					y: 0.5,
					showarrow: false,
					font: { size: 13 },
				},
			],
			margin: { l: 24, r: 24, t: 72, b: 24 },
			height: 220,
		},
	};
}

export function TradeAtlas({ src, className }: TradeAtlasProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const balanceRef = useRef<HTMLDivElement>(null);
	const importsRef = useRef<HTMLDivElement>(null);
	const exportsRef = useRef<HTMLDivElement>(null);
	const [atlasData, setAtlasData] = useState<AtlasJSON | null>(null);
	const [ready, setReady] = useState(false);
	const [activeYear, setActiveYear] = useState<string | null>(null);
	const [selectedIso, setSelectedIso] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { resolvedTheme } = useTheme();

	useEffect(() => {
		let cancelled = false;

		setAtlasData(null);
		setReady(false);
		setActiveYear(null);
		setSelectedIso(null);
		setError(null);
		const resolvedSrc = assetUrl(src);
		if (!resolvedSrc) {
			setError("Atlas source is missing.");
			return () => {
				cancelled = true;
			};
		}

		Promise.all([
			loadPlotly(),
			fetch(resolvedSrc).then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.json() as Promise<AtlasJSON>;
			}),
		])
			.then(([, payload]) => {
				if (cancelled) return;
				setAtlasData(payload);
				setActiveYear(payload.defaultYear ?? payload.yearOrder[0] ?? null);
				setReady(true);
			})
			.catch((fetchError: Error) => {
				if (!cancelled) setError(fetchError.message);
			});

		return () => {
			cancelled = true;
		};
	}, [src]);

	const currentYear =
		activeYear && atlasData ? atlasData.years[activeYear] : null;
	const selectedSummary =
		selectedIso && currentYear
			? (currentYear.countries[selectedIso] ?? null)
			: null;
	const selectedHistory =
		selectedIso && atlasData
			? (atlasData.countryHistory[selectedIso] ?? null)
			: null;

	useEffect(() => {
		if (!currentYear || !selectedIso) return;
		if (!currentYear.countries[selectedIso]) {
			setSelectedIso(null);
		}
	}, [currentYear, selectedIso]);

	const renderPlot = useCallback(
		(
			ref: React.RefObject<HTMLDivElement | null>,
			figure: VariantFigure | null,
			height?: number,
		) => {
			if (!ready || !atlasData || !ref.current || !figure) return;
			const Plotly = (window as any).Plotly;
			if (!Plotly) return;

			const layout = buildThemedLayout(
				figure,
				atlasData,
				resolvedTheme === "dark",
				height,
			);

			Plotly.react(ref.current, figure.data, layout, {
				displayModeBar: false,
				responsive: true,
			});
		},
		[ready, atlasData, resolvedTheme],
	);

	useEffect(() => {
		if (!currentYear || !mapRef.current || !atlasData || !ready) return;
		const Plotly = (window as any).Plotly;
		if (!Plotly) return;

		const figure = currentYear.map;
		const layout = buildThemedLayout(
			figure,
			atlasData,
			resolvedTheme === "dark",
			600,
		);
		const element = mapRef.current as HTMLDivElement & {
			removeAllListeners?: (event?: string) => void;
			on?: (event: string, handler: (event: any) => void) => void;
		};

		void Plotly.react(element, figure.data, layout, {
			displayModeBar: false,
			responsive: true,
		}).then(() => {
			element.removeAllListeners?.("plotly_click");
			element.on?.("plotly_click", (event: any) => {
				const nextIso = event?.points?.[0]?.location;
				if (typeof nextIso === "string") {
					setSelectedIso(nextIso);
				}
			});
		});

		return () => {
			element.removeAllListeners?.("plotly_click");
		};
	}, [currentYear, atlasData, ready, resolvedTheme]);

	useEffect(() => {
		if (!selectedSummary || !selectedHistory) return;

		renderPlot(
			balanceRef,
			createBalanceFigure(selectedHistory, activeYear ?? ""),
			320,
		);
		renderPlot(
			importsRef,
			selectedSummary.topImports.length > 0
				? createCategoryFigure(
						`Top imports from ${selectedSummary.name}`,
						selectedSummary.topImports,
						"#E63946",
					)
				: createEmptyCategoryFigure(`Top imports from ${selectedSummary.name}`),
			selectedSummary.topImports.length > 0 ? 300 : 220,
		);
		renderPlot(
			exportsRef,
			selectedSummary.topExports.length > 0
				? createCategoryFigure(
						`Top exports to ${selectedSummary.name}`,
						selectedSummary.topExports,
						"#FF9933",
					)
				: createEmptyCategoryFigure(`Top exports to ${selectedSummary.name}`),
			selectedSummary.topExports.length > 0 ? 300 : 220,
		);
	}, [selectedSummary, selectedHistory, activeYear, renderPlot]);

	useEffect(() => {
		if (!ready) return;
		const Plotly = (window as any).Plotly;
		if (!Plotly) return;

		const refs = [mapRef, balanceRef, importsRef, exportsRef];
		const resizeObserver = new ResizeObserver(() => {
			for (const ref of refs) {
				if (ref.current) {
					Plotly.Plots.resize(ref.current);
				}
			}
		});

		for (const ref of refs) {
			if (ref.current) resizeObserver.observe(ref.current);
		}

		return () => resizeObserver.disconnect();
	}, [ready, selectedSummary]);

	useEffect(() => {
		return () => {
			const Plotly = (window as any).Plotly;
			if (!Plotly) return;
			for (const ref of [mapRef, balanceRef, importsRef, exportsRef]) {
				if (ref.current) Plotly.purge(ref.current);
			}
		};
	}, []);

	const rankLabel = useMemo(() => {
		if (!selectedSummary) return null;
		if (selectedSummary.deficitRank) {
			return `Deficit rank #${selectedSummary.deficitRank}`;
		}
		if (selectedSummary.surplusRank) {
			return `Surplus rank #${selectedSummary.surplusRank}`;
		}
		return "Near balance";
	}, [selectedSummary]);

	if (error) {
		return (
			<div
				className={`my-8 rounded-xl border border-red-300 bg-red-50 p-8 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 ${className ?? ""}`}
			>
				Failed to load trade atlas: {error}
			</div>
		);
	}

	return (
		<div
			className={`my-8 rounded-2xl bg-zinc-50/40 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950/40 dark:ring-zinc-800/50 ${className ?? ""}`}
		>
			<div className="overflow-hidden rounded-[15px] border border-zinc-200/80 bg-white/90 shadow-[0_1px_1px_rgba(0,0,0,0.02)] dark:border-zinc-800/80 dark:bg-zinc-950/70">
				<div className="border-b border-zinc-200/80 bg-linear-to-b from-zinc-50 to-white px-4 py-4 dark:border-zinc-800/80 dark:from-zinc-900/90 dark:to-zinc-950/70">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
								Trade Atlas
							</p>
						</div>
						<div
							className="grid w-full max-w-[44rem] grid-cols-7 gap-1 rounded-2xl bg-zinc-100/70 p-1 dark:bg-zinc-900/80"
							role="tablist"
							aria-label="Choose year"
						>
							{atlasData?.yearOrder.map((year) => {
								const isActive = year === activeYear;
								return (
									<button
										key={year}
										type="button"
										onClick={() => setActiveYear(year)}
										className={`rounded-xl px-2 py-2 text-center text-sm font-medium transition-all ${
											isActive
												? "bg-zinc-950 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950"
												: "text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
										}`}
									>
										{year}
									</button>
								);
							})}
						</div>
					</div>
				</div>

				<div className="px-2 pt-2 md:px-3 md:pt-3">
					<div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/70 dark:bg-zinc-900/30">
						<div ref={mapRef} style={{ width: "100%", minHeight: 600 }} />
					</div>
				</div>

				{!ready && (
					<div className="flex min-h-[600px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
						Loading atlas…
					</div>
				)}

				<div className="border-t border-zinc-200/80 px-3 py-3 md:px-4 md:py-4 dark:border-zinc-800/80">
					{selectedSummary && selectedHistory ? (
						<div className="space-y-4">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
										Bilateral detail
									</p>
									<h3 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
										{selectedSummary.name}
									</h3>
									<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
										{activeYear} • {rankLabel}
									</p>
								</div>
								<button
									type="button"
									onClick={() => setSelectedIso(null)}
									className="self-start rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
								>
									Clear selection
								</button>
							</div>

							<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
								<div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 shadow-[0_1px_1px_rgba(0,0,0,0.02)] dark:border-zinc-800/80 dark:bg-zinc-900/60">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
										Exports
									</p>
									<p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
										${selectedSummary.exports.toFixed(1)}B
									</p>
								</div>
								<div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 shadow-[0_1px_1px_rgba(0,0,0,0.02)] dark:border-zinc-800/80 dark:bg-zinc-900/60">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
										Imports
									</p>
									<p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
										${selectedSummary.imports.toFixed(1)}B
									</p>
								</div>
								<div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 shadow-[0_1px_1px_rgba(0,0,0,0.02)] dark:border-zinc-800/80 dark:bg-zinc-900/60">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
										Balance
									</p>
									<p
										className={`mt-2 text-2xl font-semibold ${
											selectedSummary.balance >= 0
												? "text-emerald-600 dark:text-emerald-400"
												: "text-rose-600 dark:text-rose-400"
										}`}
									>
										{formatBillions(selectedSummary.balance)}
									</p>
								</div>
								<div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 shadow-[0_1px_1px_rgba(0,0,0,0.02)] dark:border-zinc-800/80 dark:bg-zinc-900/60">
									<p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
										Share of India’s trade
									</p>
									<p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
										{selectedSummary.tradeShare.toFixed(1)}%
									</p>
								</div>
							</div>

							<div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/70 dark:bg-zinc-900/30">
								<div
									ref={balanceRef}
									style={{ width: "100%", minHeight: 320 }}
								/>
							</div>

							<div className="grid gap-4 xl:grid-cols-2">
								<div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/70 dark:bg-zinc-900/30">
									<div
										ref={importsRef}
										style={{ width: "100%", minHeight: 220 }}
									/>
								</div>
								<div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/70 dark:bg-zinc-900/30">
									<div
										ref={exportsRef}
										style={{ width: "100%", minHeight: 220 }}
									/>
								</div>
							</div>
						</div>
					) : (
						<div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
							Click a country on the map to inspect bilateral exports, imports,
							balance over time, and the top HS4 products behind that
							relationship.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
