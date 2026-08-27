import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { geminiKey } from "./gemini";

/**
 * SPIKE — cloud transcription via gemini-3.5-transcribe (Interactions API).
 *
 * This is a test-branch toy, not a product surface. It re-transcribes the
 * raw audio we already keep beside a spoken entry. It deliberately breaks
 * the on-device rule: the audio file LEAVES THE PHONE, and on the free tier
 * Google's terms allow training on it. The UI must say so plainly and the
 * user must tap every run themselves. Nothing here runs automatically.
 *
 * Proven by curl 2026-08-27: raw upload to /upload/v1beta/files, then
 * POST /v1beta/interactions with transcription_config; custom_vocabulary
 * fixed "wovra" → "Wovera" on a synthetic sample.
 */

const UPLOAD = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const INTERACTIONS = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = "gemini-3.5-transcribe";

function mimeFor(uri: string): string {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a" || ext === "mp4" || ext === "aac") return "audio/mp4";
  if (ext === "mp3") return "audio/mp3";
  if (ext === "ogg" || ext === "opus") return "audio/ogg";
  return "audio/wav"; // expo-speech-recognition persists WAV on Android
}

interface UploadedFile {
  file?: { uri?: string; state?: string };
}

interface InteractionResult {
  status?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  error?: { message?: string };
}

/**
 * Upload the stored recording, ask the transcribe model for verbatim text.
 * `vocabulary` biases recognition toward names it would otherwise misspell.
 */
export async function cloudTranscribe(audioUri: string, vocabulary: string[]): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("The assistant isn't connected yet.");

  const bytes = new Uint8Array(await new File(audioUri).arrayBuffer());
  const mime = mimeFor(audioUri);

  const uploadRes = await expoFetch(`${UPLOAD}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": mime, "X-Goog-Upload-Protocol": "raw" },
    body: bytes,
  });
  if (!uploadRes.ok) throw new Error(`upload failed (${uploadRes.status})`);
  const uploaded = (await uploadRes.json()) as UploadedFile;
  const fileUri = uploaded.file?.uri;
  if (!fileUri) throw new Error("upload returned no file");

  const res = await expoFetch(`${INTERACTIONS}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: "audio", uri: fileUri, mime_type: mime }],
      generation_config: {
        transcription_config: {
          language_codes: ["en-IN"],
          custom_vocabulary: vocabulary.slice(0, 1000),
          mode: { type: "verbatim" },
        },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`transcription failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const result = (await res.json()) as InteractionResult;
  if (result.error?.message) throw new Error(result.error.message);
  const text = (result.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("the model returned no transcript");
  return text;
}
