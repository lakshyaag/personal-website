"use client";

import { useEffect, useState } from "react";
import type { Recommendation } from "@/lib/recommendations-storage";
import { motion } from "motion/react";

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function RecommendationList() {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/recommend")
            .then((res) => res.json())
            .then((data) => {
                setRecommendations(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="text-sm text-neutral-500">Loading recommendations...</div>;
    }

    if (recommendations.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Community Recommendations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recommendations.map((rec, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex gap-4"
                    >
                        {rec.bookCoverUrl && (
                            <div className="flex-shrink-0">
                                <img
                                    src={rec.bookCoverUrl}
                                    alt={rec.bookName}
                                    className="w-16 h-24 object-cover rounded shadow-sm"
                                />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
                                {rec.bookName}
                            </h4>
                            {rec.bookAuthor && (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                    {rec.bookAuthor}
                                </p>
                            )}
                            {rec.comment && (
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 italic line-clamp-3">
                                    "{rec.comment}"
                                </p>
                            )}
                            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                                <span>Recommended by {rec.recommenderName || "Anonymous"}</span>
                                <span>{formatDate(rec.timestamp)}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
