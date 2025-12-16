/**
 * AI provider configuration using Prime Intellect's OpenAI-compatible API
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const primeIntellect = createOpenAICompatible({
    name: "prime-intellect",
    apiKey: process.env.PRIME_API_KEY,
    baseURL: "https://api.pinference.ai/api/v1",
    supportsStructuredOutputs: true,
});

