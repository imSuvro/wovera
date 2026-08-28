import { fetch as expoFetch } from "expo/fetch";
import {
  GENTLE_SYSTEM_PROMPT,
  ROUTE_SYSTEM_PROMPT,
  TITLE_SYSTEM_PROMPT,
  WRITEBACK_SYSTEM_PROMPT,
} from "@wovera/core";

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
// The 2.5 generation is being retired for new keys (2.5-flash-lite now 404s,
// 2.5-flash starves on quota) — the house runs on 3.5.
const REPLY_MODEL = "gemini-3.5-flash";
const TITLE_MODEL = "gemini-3.5-flash-lite";
/**
 * Gemma rides a separate free-tier pool — the spare lamp for the cheap
 * mechanical jobs (titles, routing) when Gemini is resting. It rejects
 * systemInstruction and likes to think out loud, so the fallback path
 * folds the system prompt into the user text and sanitizes the output.
 */
const FALLBACK_MODEL = "gemma-4-26b-a4b-it";

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

/** Busy, not broken: worth asking a quieter model rather than going silent. */
function isBusy(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * The reply, streamed. When the main model is overloaded the house does not
 * go quiet: it asks the lighter model, and failing that takes the answer in
 * one piece from the spare lamp. A reply always arrives if one can be had.
 */
export async function streamReply(
  userPrompt: string,
  onDelta: (soFar: string) => void,
  signal?: AbortSignal,
  systemPrompt: string = GENTLE_SYSTEM_PROMPT,
  systemSuffix = "",
): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("no-key");
  const system = systemPrompt + systemSuffix;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    safetySettings: SAFETY_SETTINGS,
  });

  let res: Awaited<ReturnType<typeof expoFetch>> | null = null;
  for (const model of [REPLY_MODEL, TITLE_MODEL]) {
    const attempt = await expoFetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body,
    });
    if (attempt.ok && attempt.body) {
      res = attempt;
      break;
    }
    if (!isBusy(attempt.status)) throw new Error(`gemini-${attempt.status}`);
    if (__DEV__) console.warn(`${model} is busy (${attempt.status}) — trying the next lamp`);
  }

  if (!res) {
    // Both streams are busy. Take the whole answer at once rather than none.
    const whole = await quietCall(
      FALLBACK_MODEL,
      system,
      userPrompt,
      {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      key,
    );
    if (!whole) throw new Error("gemini-busy");
    onDelta(whole);
    return whole.trim();
  }
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

interface QuietConfig {
  temperature: number;
  maxOutputTokens: number;
  json?: boolean;
}

/** One quiet generateContent call. Returns text, or null on any failure. */
async function quietCall(
  model: string,
  systemPrompt: string,
  userText: string,
  cfg: QuietConfig,
  key: string,
): Promise<string | null> {
  const isGemma = model.startsWith("gemma");
  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: isGemma ? `${systemPrompt}\n\n---\n\n${userText}` : userText }],
      },
    ],
    generationConfig: {
      temperature: cfg.temperature,
      maxOutputTokens: cfg.maxOutputTokens,
      ...(cfg.json && !isGemma ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (!isGemma) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  try {
    const res = await expoFetch(`${BASE}/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StreamChunk;
    return chunkText(data) || null;
  } catch {
    return null;
  }
}

/** Primary model first; Gemma's separate pool when Gemini is resting. */
async function quietCallWithFallback(
  systemPrompt: string,
  userText: string,
  cfg: QuietConfig,
): Promise<string | null> {
  const key = geminiKey();
  if (!key) return null;
  const primary = await quietCall(TITLE_MODEL, systemPrompt, userText, cfg, key);
  if (primary) return primary;
  return quietCall(FALLBACK_MODEL, systemPrompt, userText, cfg, key);
}

/** Quick-capture routing — cheapest model, JSON out, current time provided. */
export async function routeCapture(captureText: string): Promise<string | null> {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const raw = await quietCallWithFallback(
    ROUTE_SYSTEM_PROMPT,
    `Current local datetime: ${stamp}\n\nCapture: ${captureText}`,
    { temperature: 0.1, maxOutputTokens: 256, json: true },
  );
  if (!raw) return null;
  // Gemma narrates before answering — hand the parser just the JSON object.
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : raw;
}

export async function generateTitle(entryBody: string): Promise<string | null> {
  const raw = await quietCallWithFallback(TITLE_SYSTEM_PROMPT, entryBody.slice(0, 4000), {
    temperature: 0.4,
    maxOutputTokens: 128,
  });
  if (!raw) return null;
  // The title is the LAST non-empty line — reasoning-happy models put the
  // answer at the end; for Gemini it's the only line anyway.
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = (lines[lines.length - 1] ?? "").replace(/^["'*#\s]+|["'*.\s]+$/g, "");
  return title && title.length <= 60 ? title : null;
}
