"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ChartJSON {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  darkOverrides: Record<string, unknown>;
  lightOverrides: Record<string, unknown>;
  darkAnnotation: { color: string; bgcolor: string };
  lightAnnotation: { color: string; bgcolor: string };
}

interface PlotlyChartProps {
  /** Path to the chart JSON file (relative to public/) */
  src: string;
  /** Override chart height in px */
  height?: number;
  /** Additional CSS class on the wrapper div */
  className?: string;
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
    const sv = source[key];
    if (sv && typeof sv === "object" && !Array.isArray(sv)) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) ?? {},
        sv as Record<string, unknown>,
      );
    } else {
      result[key] = sv;
    }
  }
  return result;
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

export function PlotlyChart({ src, height, className }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [chartData, setChartData] = useState<ChartJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  // Load Plotly + fetch chart data in parallel
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadPlotly(),
      fetch(src)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<ChartJSON>;
        }),
    ])
      .then(([, data]) => {
        if (!cancelled) {
          setChartData(data);
          setReady(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Render / re-render on theme change
  const render = useCallback(() => {
    if (!ready || !chartData || !chartRef.current) return;

    const Plotly = (window as any).Plotly;
    if (!Plotly) return;

    const isDark = resolvedTheme === "dark";
    const overrides = isDark
      ? chartData.darkOverrides
      : chartData.lightOverrides;
    const annStyle = isDark
      ? chartData.darkAnnotation
      : chartData.lightAnnotation;

    const layout = deepMerge(
      chartData.layout,
      overrides,
    ) as Record<string, any>;

    // Patch annotation colors for the active theme
    if (layout.annotations && Array.isArray(layout.annotations)) {
      layout.annotations = layout.annotations.map(
        (a: Record<string, any>) => ({
          ...a,
          font: { ...(a.font ?? {}), color: annStyle.color },
          bgcolor: annStyle.bgcolor,
        }),
      );
    }

    // Make chart responsive
    layout.autosize = true;
    if (height) layout.height = height;

    // Transparent paper so the blog background shows through
    layout.paper_bgcolor = "rgba(0,0,0,0)";

    Plotly.react(chartRef.current, chartData.data, layout, {
      displayModeBar: false,
      responsive: true,
    });
  }, [ready, chartData, resolvedTheme, height]);

  // biome-ignore lint: render depends on all relevant state
  useEffect(() => {
    render();
  }, [render]);

  // Resize observer for responsive charts
  useEffect(() => {
    if (!ready || !chartRef.current) return;

    const Plotly = (window as any).Plotly;
    if (!Plotly) return;

    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        Plotly.Plots.resize(chartRef.current);
      }
    });
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [ready]);

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
      ref={containerRef}
      className={`my-8 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 ${className ?? ""}`}
    >
      {/* Chart target */}
      <div ref={chartRef} style={{ width: "100%", minHeight: height ?? 500 }} />

      {/* Loading skeleton */}
      {!ready && (
        <div className="flex items-center justify-center" style={{ minHeight: height ?? 500 }}>
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
