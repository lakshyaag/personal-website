"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { TRANSITION_SECTION, VARIANTS_CONTAINER, VARIANTS_SECTION } from "@/lib/utils";

type AirportRow = {
  ident: string;
  our_id: number | null;
  type: string | null;
  name: string | null;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  continent: string | null;
  iso_country: string | null;
  iso_region: string | null;
  municipality: string | null;
  gps_code: string | null;
  iata_code: string | null;
  local_code: string | null;
  visited: number;
  visited_at: string | null;
};

type PagedAirports = {
  items: AirportRow[];
  total: number;
  limit: number;
  offset: number;
};

function useAirports() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState("");
  const [visitedOnly, setVisitedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [data, setData] = useState<PagedAirports>({ items: [], total: 0, limit: pageSize, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("q", query.trim());
    if (country.trim()) sp.set("country", country.trim().toUpperCase());
    if (type.trim()) sp.set("type", type.trim());
    if (visitedOnly) sp.set("visitedOnly", "true");
    sp.set("limit", String(pageSize));
    sp.set("offset", String(page * pageSize));
    return sp.toString();
  }, [query, country, type, visitedOnly, page]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/airports?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const json = (await res.json()) as PagedAirports;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return {
    query,
    setQuery,
    country,
    setCountry,
    type,
    setType,
    visitedOnly,
    setVisitedOnly,
    page,
    setPage,
    pageSize,
    data,
    loading,
    error,
  };
}

function useStats() {
  const [stats, setStats] = useState<{ total: number; visited: number; topCountries: { country: string; visited_count: number }[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/airports/stats`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (!cancelled) setStats(json);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

export default function AirportsPage() {
  const airports = useAirports();
  const stats = useStats();
  const [importing, setImporting] = useState(false);

  async function importData() {
    setImporting(true);
    try {
      const res = await fetch("/api/airports/import", { method: "POST" });
      if (!res.ok) throw new Error("Import failed");
      // reload first page and stats
      airports.setPage(0);
    } catch (e) {
      // ignore for now
      console.error(e);
    } finally {
      setImporting(false);
    }
  }

  async function toggleVisit(ident: string, next: boolean) {
    const res = await fetch(`/api/airports/${encodeURIComponent(ident)}/visit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visited: next }),
    });
    if (res.ok) {
      // trigger reload
      airports.setPage(airports.page);
    }
  }

  const totalPages = Math.ceil((airports.data.total || 0) / airports.pageSize);

  return (
    <motion.main
      className="space-y-10"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.section variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium">Airport Visits</h1>
          <button
            className="text-sm underline text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
            onClick={importData}
            disabled={importing}
          >
            {importing ? "Importing…" : "Import OurAirports CSV"}
          </button>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          Free worldwide airport data from OurAirports. Track where you have flown.
        </p>
      </motion.section>

      <motion.section variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            value={airports.query}
            onChange={(e) => {
              airports.setPage(0);
              airports.setQuery(e.target.value);
            }}
            placeholder="Search name, ident, city, IATA"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={airports.country}
            onChange={(e) => {
              airports.setPage(0);
              airports.setCountry(e.target.value);
            }}
            placeholder="Country code (e.g. US, IN)"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={airports.type}
            onChange={(e) => {
              airports.setPage(0);
              airports.setType(e.target.value);
            }}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All types</option>
            <option value="large_airport">Large airport</option>
            <option value="medium_airport">Medium airport</option>
            <option value="small_airport">Small airport</option>
            <option value="heliport">Heliport</option>
            <option value="seaplane_base">Seaplane base</option>
            <option value="closed">Closed</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={airports.visitedOnly}
              onChange={(e) => {
                airports.setPage(0);
                airports.setVisitedOnly(e.target.checked);
              }}
            />
            Visited only
          </label>
        </div>
      </motion.section>

      <motion.section variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {airports.loading ? "Loading…" : `${airports.data.total} airports`}
          </p>
          {stats && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Visited {stats.visited} of {stats.total}
            </p>
          )}
        </div>
        {airports.error && (
          <div className="text-sm text-red-600">{airports.error}</div>
        )}
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800">
          {airports.data.items.map((a) => (
            <div key={a.ident} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate max-w-[55vw] sm:max-w-[40vw]">{a.name || a.ident}</span>
                  {a.iata_code && (
                    <span className="text-xs text-zinc-500">IATA {a.iata_code}</span>
                  )}
                  {a.gps_code && (
                    <span className="text-xs text-zinc-500">ICAO {a.gps_code}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[65vw] sm:max-w-[50vw]">
                  {[a.municipality, a.iso_country, a.type].filter(Boolean).join(" • ")}
                </p>
              </div>
              <button
                onClick={() => toggleVisit(a.ident, a.visited ? false : true)}
                className={`text-xs rounded-md px-2 py-1 border transition-colors ${
                  a.visited
                    ? "border-green-600 text-green-700 dark:text-green-400"
                    : "border-zinc-400 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {a.visited ? "Visited" : "Mark visited"}
              </button>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <button
              className="underline disabled:opacity-50"
              disabled={airports.page === 0}
              onClick={() => airports.setPage(Math.max(0, airports.page - 1))}
            >
              Previous
            </button>
            <span className="text-zinc-600 dark:text-zinc-400">
              Page {airports.page + 1} of {totalPages}
            </span>
            <button
              className="underline disabled:opacity-50"
              disabled={airports.page + 1 >= totalPages}
              onClick={() => airports.setPage(Math.min(totalPages - 1, airports.page + 1))}
            >
              Next
            </button>
          </div>
        )}
      </motion.section>

      {stats && stats.topCountries?.length > 0 && (
        <motion.section variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
          <h3 className="text-lg font-medium mb-2">Top countries by visits</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {stats.topCountries.map((c) => (
              <div key={c.country} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span>{c.country}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{c.visited_count}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </motion.main>
  );
}

