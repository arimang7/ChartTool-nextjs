import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Model priority: newest + most capable first
export const MODELS = [
  { id: "gemini-3.1-flash-lite-preview", label: "🔬 gemini-3.1-flash-lite-preview", priority: 1 },
  { id: "gemini-3-flash-preview",        label: "🚀 gemini-3-flash-preview",        priority: 2 },
  { id: "gemini-2.5-flash",              label: "✨ gemini-2.5-flash",              priority: 3 },
  { id: "gemini-flash-latest",           label: "⚡ gemini-flash-latest",           priority: 4 },
  { id: "gemini-2.5-flash-lite",         label: "💨 gemini-2.5-flash-lite",         priority: 5 },
];

async function pingModel(modelId: string): Promise<{ latency: number; status: "fast" | "normal" | "busy" }> {
  const start = Date.now();
  try {
    await ai.models.generateContent({
      model: modelId,
      contents: "hi",
      config: { maxOutputTokens: 1 },
    });
    const latency = Date.now() - start;
    const status = latency < 3000 ? "fast" : latency < 8000 ? "normal" : "busy";
    return { latency, status };
  } catch {
    return { latency: 99999, status: "busy" };
  }
}

export async function GET() {
  const results = await Promise.all(
    MODELS.map(async (m) => {
      const { latency, status } = await pingModel(m.id);
      return { id: m.id, label: m.label, priority: m.priority, latency, status };
    })
  );

  // Auto-select: pick "fast" first, then "normal", by priority order
  const best =
    results.find((r) => r.status === "fast") ||
    results.find((r) => r.status === "normal") ||
    results[0];

  return NextResponse.json({ models: results, recommended: best.id });
}
