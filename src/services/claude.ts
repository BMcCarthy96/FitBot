import Anthropic from "@anthropic-ai/sdk";
import { AIFoodAnalysis } from "../types";

const client = new Anthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "",
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are a precise nutrition analysis AI. When given a food image, you analyze it and return ONLY valid JSON matching the exact schema provided. Be accurate with calorie and macro estimates based on visible portion sizes.

Health Score criteria (0-100):
- 90-100: Whole foods, minimal processing, nutrient-dense (leafy greens, lean proteins, legumes)
- 70-89: Lightly processed, good nutritional profile (whole grain bread, yogurt, eggs)
- 50-69: Moderate nutrition, some processing (mixed dishes, low-sugar granola bars)
- 30-49: High calories, low nutrients, moderate processing (white rice bowls, pasta)
- 0-29: Ultra-processed, high sugar/sodium/trans fat (fast food, candy, chips)`;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function analyzeFoodImage(base64: string, healthyPreferences: string[] = []): Promise<AIFoodAnalysis> {
  const prefsContext = healthyPreferences.length > 0
    ? `The user prefers these healthy foods: ${healthyPreferences.slice(-10).join(", ")}.`
    : "Suggest universally healthy alternatives.";

  const prompt = `Analyze this food image and return ONLY a JSON object with this exact structure:
{
  "name": "food name",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "healthScore": number (0-100),
  "isHealthy": boolean (true if healthScore >= 60),
  "healthNotes": "brief explanation of health assessment",
  "alternatives": [
    {
      "name": "alternative food name",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "healthScore": number,
      "reason": "why this is a healthier choice"
    }
  ]
}

${prefsContext}
Provide 2-3 alternatives if the food scores below 70, otherwise 1-2 healthier variations.
Return ONLY the JSON object, no other text.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No response from AI");

  const jsonText = textBlock.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(jsonText) as AIFoodAnalysis;
}

export async function chat(messages: Message[], systemPrompt?: string): Promise<string> {
  const system = systemPrompt ?? "You are a helpful health and nutrition assistant.";
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text content in response");
  return textBlock.text;
}
