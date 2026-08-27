import { fetch as expoFetch } from "expo/fetch";
import { GENTLE_SYSTEM_PROMPT, TITLE_SYSTEM_PROMPT, WRITEBACK_SYSTEM_PROMPT } from "@wovera/core";

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
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
}

/**
 * A private journal writes about hard things — debt, drink, dark nights.
 * Default mid-threshold safety filters stop replies mid-sentence on exactly
 * the entries that matter most. Only-high keeps guardrails without muzzling
 * the friend.
 */
const SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" }));

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
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      safetySettings: SAFETY_SETTINGS,
    }),
  });
  if (!res.ok) throw new Error(`gemini-${res.status}`);
  if (!res.body) throw new Error("gemini-no-stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let lastFlush = 0;
  let finishReason: string | null = null;

  // Proper SSE: events end on a blank line; an event's data may span
  // multiple `data:` lines that concatenate. Parsing per-event (not
  // per-line) means a JSON payload can never be split and silently lost.
  const handleEvent = (rawEvent: string) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!data || data === "[DONE]") return;
    try {
      const chunk = JSON.parse(data) as StreamChunk;
      text += chunkText(chunk);
      finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
    } catch {
      if (__DEV__) console.warn("gemini: unparseable SSE event", data.slice(0, 120));
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) handleEvent(event);
    // ~50ms flush window: streaming feel without re-render storms (perf pillar).
    const now = Date.now();
    if (now - lastFlush > 50) {
      lastFlush = now;
      onDelta(text);
    }
  }
  if (buffer.trim()) handleEvent(buffer);
  onDelta(text);

  if (__DEV__) console.log(`gemini reply: ${text.length} chars, finish=${finishReason}`);
  if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
    // The model was stopped by a filter mid-thought. Be honest about it.
    throw new Error("gemini-filtered");
  }
  return text.trim();
}

/** The writeback judgment call — JSON out, quiet model, no streaming. */
export async function proposeWritebacks(userPrompt: string): Promise<string | null> {
  const key = geminiKey();
  if (!key) return null;
  try {
    const res = await expoFetch(`${BASE}/${REPLY_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: WRITEBACK_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
        safetySettings: SAFETY_SETTINGS,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StreamChunk;
    return chunkText(data) || null;
  } catch {
    return null;
  }
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
