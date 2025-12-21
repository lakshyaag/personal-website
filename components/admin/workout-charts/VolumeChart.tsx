"use client";

import { useMemo } from "react";
import { ChartEmptyState } from "./EmptyState";
import { CHART_COLORS, formatDateLabel } from "./utils";

interface VolumeEntry {
	date?: string;
	week?: string;
	volume: number;
}

interface VolumeChartProps {
	data: VolumeEntry[];
	mode: "day" | "week";
}

function getKey(entry: VolumeEntry): string {
	return entry.week ?? entry.date ?? "";
}

export function VolumeChart({ data, mode }: VolumeChartProps) {
	const { entries, maxVolume, avgVolume } = useMemo(() => {
		const displayData = mode === "day" ? data.slice(-30) : data;
		const volumes = displayData.map((d) => d.volume);
		const max = Math.max(...volumes, 1);
		const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length || 0;
		return { entries: displayData, maxVolume: max, avgVolume: avg };
	}, [data, mode]);

	if (entries.length === 0) {
		return <ChartEmptyState />;
	}

	const avgPercent = (avgVolume / maxVolume) * 100;
	const isDaily = mode === "day";

	return (
		<div className="space-y-4">
			<div className="relative">
				<div
					className={`absolute left-0 right-0 border-t-2 border-dashed ${CHART_COLORS.avgLine} z-10 pointer-events-none`}
					style={{ top: `${((100 - avgPercent) / 100) * 160}px` }}
				>
					<span
						className={`absolute -top-5 right-1 text-xs ${CHART_COLORS.avgText}`}
					>
						Avg:{" "}
						{avgVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
						lbs
					</span>
				</div>

				<div className="flex items-end gap-1 h-40">
					{entries.map((entry, idx) => {
						const key = getKey(entry);
						const heightPercent = (entry.volume / maxVolume) * 100;
						const isAboveAvg = entry.volume >= avgVolume;

						return (
							<div
								key={key}
								className="flex-1 flex flex-col items-center min-w-0"
							>
								<div className="w-full h-40 flex items-end">
									<div
										className={`w-full rounded-t transition-all ${
											isAboveAvg
												? CHART_COLORS.barActive
												: CHART_COLORS.barInactive
										}`}
										style={{
											height: `${heightPercent}%`,
											minHeight: entry.volume > 0 ? "2px" : "0",
										}}
										title={`${formatDateLabel(key)}: ${entry.volume.toLocaleString()} lbs`}
									/>
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex gap-1 mt-1">
					{entries.map((entry, idx) => {
						const key = getKey(entry);
						const showLabel = isDaily
							? idx === 0 || idx === entries.length - 1 || idx % 7 === 0
							: true;
						return (
							<div key={`label-${key}`} className="flex-1 min-w-0">
								{showLabel && (
									<span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate text-center">
										{formatDateLabel(key)}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="flex items-center justify-between flex-wrap gap-2">
				<div className="flex items-center gap-4 text-xs text-zinc-500">
					<div className="flex items-center gap-2">
						<div className={`w-3 h-3 rounded ${CHART_COLORS.barActive}`} />
						<span>Above avg</span>
					</div>
					<div className="flex items-center gap-2">
						<div className={`w-3 h-3 rounded ${CHART_COLORS.barInactive}`} />
						<span>Below avg</span>
					</div>
				</div>
				{isDaily && <span className="text-xs text-zinc-500">Last 30 days</span>}
			</div>
		</div>
	);
}
