import { analyzeFoodEntry } from "@/lib/food-analysis-server";
import { after } from "next/server";

export const maxDuration = 60;

/**
 * Supabase Database Webhook handler for food entry analysis.
 * This endpoint is triggered whenever a food entry is created or updated.
 */
export async function POST(req: Request) {
    const secret = req.headers.get("x-webhook-secret");

    // Security check
    if (secret !== process.env.WEBHOOK_SECRET) {
        console.error("[Webhook] Unauthorized access attempt");
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const payload = await req.json();

        // Supabase Webhook payload structure
        const { type, record } = payload;
        const entryId = record?.id;

        if (!entryId) {
            console.error("[Webhook] Missing record ID in payload");
            return new Response("Missing Entry ID", { status: 400 });
        }

        console.log(`[Webhook] Triggering analysis for entry: ${entryId} (${type})`);

        // Use after() to respond immediately and run analysis in background
        after(async () => {
            try {
                await analyzeFoodEntry(entryId);
            } catch (err) {
                console.error(`[Background AI Analysis Error for ${entryId}]:`, err);
            }
        });

        return new Response(`Accepted ${entryId} for processing`, { status: 202 });
    } catch (error) {
        console.error("[Webhook Error]:", error);
        return new Response(
            JSON.stringify({ error: "Internal processing error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

