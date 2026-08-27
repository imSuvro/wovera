import { fetch as expoFetch } from "expo/fetch";
import { GENTLE_SYSTEM_PROMPT, TITLE_SYSTEM_PROMPT } from "@wovera/core";

/**
 * Gemini client. Dev runs on the free tier with the key from .env
 * (EXPO_PUBLIC_ — dev builds only; production routes through a backend).
 * HARD RULE from the data-terms research: before real personal vault data
 * flows here, the Google Cloud project must have billing attached so the
 * no-training "Paid Services" terms apply.
 *
 * Replies stream over SSE via expo/fetch (RN's WinterCG fetch supports
 * response streaming); titles use the cheapest Flash-Lite call.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REPLY_MODEL = "gemini-2.5-flash";
const TITLE_MODEL = "gemini-2.5-flash-lite";

export function geminiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  return key && key.length > 10 ? key : null;
}

interface StreamChunk {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function chunkText(chunk: StreamChunk): string {
  return chunk.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

export async function streamReply(
  userPrompt: string,
  onDelta: (soFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("no-key");
  const res = await expoFetch(`${BASE}/${REPLY_MODEL}:streamGenerateContent?alt=sse&key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GENTLE_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) throw new Error(`gemini-${res.status}`);
  if (!res.body) throw new Error("gemini-no-stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let lastFlush = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        text += chunkText(JSON.parse(payload) as StreamChunk);
      } catch {
        // partial JSON across SSE frames — rare with line-delimited SSE; skip
      }
    }
    // ~50ms flush window: streaming feel without re-render storms (perf pillar).
    const now = Date.now();
    if (now - lastFlush > 50) {
      lastFlush = now;
      onDelta(text);
    }
  }
  onDelta(text);
  return text.trim();
}

export async function generateTitle(entryBody: string): Promise<string | null> {
  const key = geminiKey();
  if (!key) return null;
  try {
    const res = await expoFetch(`${BASE}/${TITLE_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TITLE_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: entryBody.slice(0, 4000) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 128 },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StreamChunk;
    const title = chunkText(data)
      .trim()
      .replace(/^["']|["'.]$/g, "");
    return title && title.length <= 60 ? title : null;
  } catch {
    return null;
  }
}
