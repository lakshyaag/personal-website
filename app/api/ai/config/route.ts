import type { NextRequest } from "next/server";
import { getAIConfig, updateAIConfig } from "@/lib/ai-config-db";

export async function GET() {
    try {
        const config = await getAIConfig();
        return Response.json(config);
    } catch (error) {
        console.error("Error fetching AI config:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to fetch AI configuration",
                details: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { modelName, providerName } = body;

        if (modelName !== undefined && typeof modelName !== "string") {
            return new Response(
                JSON.stringify({ error: "modelName must be a string" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        if (providerName !== undefined && typeof providerName !== "string") {
            return new Response(
                JSON.stringify({ error: "providerName must be a string" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        await updateAIConfig({ modelName, providerName });
        const updatedConfig = await getAIConfig();
        return Response.json(updatedConfig);
    } catch (error) {
        console.error("Error updating AI config:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to update AI configuration",
                details: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
}

