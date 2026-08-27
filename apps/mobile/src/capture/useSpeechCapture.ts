import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/**
 * The Lamp's listening engine.
 *
 * Drives the OS speech recognizer via expo-speech-recognition with the
 * contract from the research + privacy pillar:
 * - on-device recognition forced (words never leave the phone)
 * - continuous mode with SEGMENT STITCHING: Android finalizes a segment and
 *   ends the session on pauses; we append the segment and restart instantly,
 *   so a 15-minute ramble survives as one entry
 * - raw audio persisted alongside (the verbatim promise's safety net)
 * - graceful degradation: if the native module isn't in this build (or web),
 *   `supported` is false and the typed path carries capture
 */

export interface SpeechCaptureState {
  status: "idle" | "listening" | "stopping";
  /** Finalized text so far (stitched segments). */
  finalText: string;
  /** The live, still-changing tail. */
  interimText: string;
  /** 0..1 mic level for the waveform. */
  volume: number;
  /** Path of the persisted raw audio, when the OS delivered one. */
  audioUri: string | null;
  /** Stitch count — visible in dev to instrument boundary loss. */
  segments: number;
  error: string | null;
}

interface SpeechModuleShape {
  ExpoSpeechRecognitionModule: {
    start(options: Record<string, unknown>): void;
    stop(): void;
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    addListener(event: string, handler: (payload: never) => void): { remove(): void };
    androidTriggerOfflineModelDownload?(options: { locale: string }): Promise<unknown>;
  };
}

function loadModule(): SpeechModuleShape["ExpoSpeechRecognitionModule"] | null {
  if (Platform.OS === "web") return null; // web voice arrives with its own consent labeling later
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition") as SpeechModuleShape;
    return mod.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null; // module not in this binary yet — typed capture carries it
  }
}

const speech = loadModule();

export function useSpeechCapture() {
  const [state, setState] = useState<SpeechCaptureState>({
    status: "idle",
    finalText: "",
    interimText: "",
    volume: 0,
    audioUri: null,
    segments: 0,
    error: null,
  });
  // The user's intent, readable inside event handlers without stale closures.
  const wantListening = useRef(false);

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener(
        "result",
        (event: { results?: { transcript?: string }[]; isFinal?: boolean }) => {
          const transcript = event.results?.[0]?.transcript ?? "";
          setState((s) => {
            if (event.isFinal) {
              const joined = s.finalText
                ? `${s.finalText} ${transcript}`.trim()
                : transcript.trim();
              return { ...s, finalText: joined, interimText: "", segments: s.segments + 1 };
            }
            return { ...s, interimText: transcript };
          });
        },
      ),
      speech.addListener("volumechange", (event: { value?: number }) => {
        // Library range is roughly -2..10.
        const v = Math.max(0, Math.min(1, ((event.value ?? 0) + 2) / 12));
        setState((s) => (s.status === "listening" ? { ...s, volume: v } : s));
      }),
      speech.addListener("audioend", (event: { uri?: string | null }) => {
        if (event.uri) setState((s) => ({ ...s, audioUri: event.uri ?? s.audioUri }));
      }),
      speech.addListener("end", () => {
        // Session ended. If the user still wants to talk, stitch: restart now.
        if (wantListening.current) {
          startSession();
        } else {
          setState((s) => ({ ...s, status: "idle", volume: 0 }));
        }
      }),
      speech.addListener("error", (event: { error?: string; message?: string }) => {
        // "no-speech" during a long pause is normal — the end handler restarts.
        if (event.error === "no-speech") return;
        wantListening.current = false;
        const raw = `${event.error ?? ""} ${event.message ?? ""}`;
        // On-device model missing: ask Android to fetch it, say so honestly.
        if (/not yet downloaded|language-not-supported|language_not_supported/i.test(raw)) {
          void speech.androidTriggerOfflineModelDownload?.({ locale: "en-IN" });
          setState((s) => ({
            ...s,
            status: "idle",
            volume: 0,
            error:
              "Downloading the on-device voice for English (India) — give it a minute, then tap again.",
          }));
          return;
        }
        setState((s) => ({
          ...s,
          status: "idle",
          volume: 0,
          error: event.message ?? event.error ?? "speech failed",
        }));
      }),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, []);

  const startSession = () => {
    speech?.start({
      lang: "en-IN",
      interimResults: true,
      continuous: true,
      // The privacy pillar: words are recognized on this device. The
      // more-accurate network recognizer stays a labeled opt-in (House Rules).
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
      recordingOptions: { persist: true },
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    });
  };

  const start = useCallback(async () => {
    if (!speech) return;
    const { granted } = await speech.requestPermissionsAsync();
    if (!granted) {
      setState((s) => ({ ...s, error: "Microphone permission is needed to talk." }));
      return;
    }
    wantListening.current = true;
    setState({
      status: "listening",
      finalText: "",
      interimText: "",
      volume: 0,
      audioUri: null,
      segments: 0,
      error: null,
    });
    startSession();
  }, []);

  const stop = useCallback(() => {
    wantListening.current = false;
    setState((s) => ({ ...s, status: "stopping" }));
    speech?.stop();
  }, []);

  return { supported: speech !== null, state, start, stop };
}
