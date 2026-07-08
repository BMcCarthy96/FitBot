import { AIFoodAnalysis } from "../types";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Demo rate limit reached — please try again in a minute.");
  if (!res.ok) throw new Error("Request failed — please try again.");
  return res.json() as Promise<T>;
}

export async function analyzeFoodImage(base64: string, healthyPreferences: string[] = []): Promise<AIFoodAnalysis> {
  return post<AIFoodAnalysis>("/api/analyze", { base64, healthyPreferences });
}

export async function chat(messages: Message[], _systemPrompt?: string): Promise<string> {
  const { reply } = await post<{ reply: string }>("/api/chat", { messages });
  return reply;
}

// Fails to compile if this file's exports drift from the native claude.ts contract.
const _parity: typeof import("./claude") = { analyzeFoodImage, chat };
void _parity;
