import { parseRouteResult } from "@wovera/core";
import type { VaultDocument } from "@wovera/core";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Keyframe,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { routeCapture } from "../../assistant/gemini";
import { AskPanel } from "../../components/AskPanel";
import { Card } from "../../components/Card";
import { Letter } from "../../components/Letter";
import { Screen } from "../../components/Screen";
import { TalkCircle } from "../../components/TalkCircle";
import { TopRow } from "../../components/TopRow";
import { Vignette } from "../../components/Vignette";
import { Waveform } from "../../components/Waveform";
import { useReply } from "../../assistant/useReply";
import { onLampTap } from "../../capture/lampBus";
import { useLampSession } from "../../capture/LampSession";
import type { LampPhase } from "../../capture/LampSession";
import { useSpeechCapture } from "../../capture/useSpeechCapture";
import { fonts, space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useVault } from "../../vault/VaultProvider";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Placeholder until Flash-Lite files the entry under its real name. */
function entryTitle(now = new Date()): string {
  const part =
    now.getHours() < 5
      ? "Night"
      : now.getHours() < 12
        ? "Morning"
        : now.getHours() < 17
          ? "Afternoon"
          : "Evening";
  return `${part} entry · ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/**
 * The greeting knows the hour — computed once per app open, never cute
 * twice in a row (Pattern Book, Plate IV, Act I).
 */
function greetingForNow(now = new Date()): string {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 23.5 || h < 4) return "Still up? So is the lamp.";
  if (h < 7) return "The lamp is lit early.";
  return "The lamp is on.";
}
const GREETING = greetingForNow();

/** The seal's arrival: contract-and-settle with one soft overshoot, 400ms. */
const sealEnter = new Keyframe({
  0: { transform: [{ scale: 0.62 }], opacity: 0 },
  70: { transform: [{ scale: 1.05 }], opacity: 1 },
  100: { transform: [{ scale: 1 }], opacity: 1 },
}).duration(400);

/** A small lamp — the seal beside "Kept, exactly." and the docked send action. */
function MiniLamp({ size, breathing = false }: { size: number; breathing?: boolean }) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      style={[
        breathing &&
          !reducedMotion && {
            // Thinking is the seal breathing — never dots in a box.
            animationName: {
              "0%": { transform: [{ scale: 1 }], opacity: 1 },
              "50%": { transform: [{ scale: 1.08 }], opacity: 0.88 },
              "100%": { transform: [{ scale: 1 }], opacity: 1 },
            },
            animationDuration: "2.6s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          },
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={`mini${size}`} cx="50%" cy="42%" r="62%">
            <Stop offset="0%" stopColor="#f6d9a4" />
            <Stop offset="45%" stopColor="#eab263" />
            <Stop offset="80%" stopColor="#b97f35" />
            <Stop offset="100%" stopColor="#7d5320" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#mini${size})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The Lamp — capture in three acts (Pattern Book, Plate IV).
 * Act I: arrival — vignette, hour-aware greeting, the lamp breathing.
 * Act II: listening — the room recedes, the transcript floats unboxed,
 *         and the flame flickers with the voice.
 * Act III: kept — the lamp contracts into a seal, the reply arrives as a
 *          Letter, and held pages plant themselves in the sage panel.
 */
export default function LampScreen() {
  const { theme, name } = useTheme();
  const vault = useVault();
  const reducedMotion = useReducedMotion();
  const { setPhase } = useLampSession();
  const micVolume = useSharedValue(0);
  const { supported, state, start, stop } = useSpeechCapture();
  const { state: reply, run: runReply, reset: resetReply } = useReply(vault);
  const [typed, setTyped] = useState<string | null>(null); // null = not typing
  const [kept, setKept] = useState<VaultDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [quiet, setQuiet] = useState(false);
  // Tell-or-ask (PB-2): the house's read of a finished capture, correctable
  // for a beat before anything is committed.
  const [pending, setPending] = useState<{
    text: string;
    audioUri: string | null;
    read: "entry" | "question";
  } | null>(null);
  const [askText, setAskText] = useState<string | null>(null);
  const [askSettled, setAskSettled] = useState(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef<ScrollView>(null);

  const listening = state.status === "listening" || state.status === "stopping";
  const liveText = [state.finalText, state.interimText].filter(Boolean).join(" ");

  // Publish the act to the house (NavBar recedes with us). Deferred a frame —
  // effects must not set state synchronously.
  const phase: LampPhase = listening ? "listening" : kept ? "kept" : "idle";
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase(phase));
    return () => cancelAnimationFrame(id);
  }, [setPhase, phase]);

  // The mic level rides a shared value — the flame reads it on the UI thread.
  useEffect(() => {
    micVolume.value = state.volume;
  }, [micVolume, state.volume]);

  // Silence is met with patience: after 4s of quiet the hint fades in.
  const lastWordsAt = useRef(0);
  useEffect(() => {
    lastWordsAt.current = Date.now();
  }, [liveText]);
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => {
      setQuiet(Date.now() - lastWordsAt.current >= 4000);
    }, 800);
    return () => clearInterval(id);
  }, [listening]);

  const keepEntry = async (bodyMd: string, audioUri: string | null) => {
    if (!vault || !bodyMd.trim() || saving) return;
    setSaving(true);
    try {
      const doc = await vault.createDocument({
        type: "journal",
        title: entryTitle(),
        bodyMd: bodyMd.trim(),
        audioUri,
      });
      setKept(doc);
      setTyped(null);
      // The entry is safe. Now the friend who has read everything replies.
      void runReply(doc);
    } finally {
      setSaving(false);
    }
  };

  // The house reads a finished capture — telling or asking? The read must
  // never stall the words: 1200ms cap, silence defaults to keeping. Then the
  // correction chip shows for 2.5s before anything commits.
  const commit = () => {
    const p = pendingRef.current;
    if (!p) return;
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    setPending(null);
    if (p.read === "question") {
      setAskText(p.text);
      setAskSettled(false);
    } else {
      void keepEntry(p.text, p.audioUri);
    }
  };
  const commitRef = useRef(commit);
  const pendingRef = useRef(pending);
  useEffect(() => {
    commitRef.current = commit;
    pendingRef.current = pending;
  });

  const settleCapture = (text: string, audioUri: string | null) => {
    if (!text.trim()) return;
    void (async () => {
      let read: "entry" | "question" = "entry";
      try {
        const raw = await Promise.race([
          routeCapture(text),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
        ]);
        if (raw && parseRouteResult(raw, text).kind === "question") read = "question";
      } catch {
        // The read failed — the words are kept, always.
      }
      setPending({ text, audioUri, read });
      pendingTimer.current = setTimeout(() => commitRef.current(), 2500);
    })();
  };

  const flipPending = () => {
    setPending((p) => (p ? { ...p, read: p.read === "entry" ? "question" : "entry" } : p));
    // A flip earns a fresh beat before committing.
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => commitRef.current(), 2500);
  };

  const onCirclePress = () => {
    if (pending) return; // the chip's beat — let it land
    setKept(null);
    resetReply();
    setAskText(null);
    setAskSettled(false);
    if (!supported) {
      // Voice needs the build that carries the speech module — typing works now.
      setTyped((t) => t ?? "");
      return;
    }
    if (listening) {
      stop();
      // Settle on the next tick with whatever was stitched; audio uri arrives
      // via audioend just before end — state already holds it by then.
      setTimeout(() => {
        settleCapture(
          [state.finalText, state.interimText].filter(Boolean).join(" "),
          state.audioUri,
        );
      }, 350);
    } else {
      void start();
    }
  };

  // The NavLamp, tapped while this room is already open, means the same
  // thing as the big lamp: start talking (or finish, if already listening).
  const lampTapRef = useRef(onCirclePress);
  useEffect(() => {
    lampTapRef.current = onCirclePress;
  });
  useEffect(() => onLampTap(() => lampTapRef.current()), []);
  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  const displayTitle = reply.title ?? kept?.title ?? "";
  const replySettled = reply.status === "done" || reply.status === "error";

  return (
    <Screen>
      <Vignette strength={listening ? 0.5 : 1} />
      <Animated.View
        style={{
          // Act II: the room recedes while the lamp listens.
          opacity: listening ? 0.3 : 1,
          transitionProperty: "opacity",
          transitionDuration: "200ms",
        }}
      >
        <TopRow />
        <Text style={[styles.greet, { color: theme.ink }]}>{GREETING}</Text>
        <Text style={[styles.sub, { color: theme.inkSoft }]}>
          {listening
            ? "Listening. Take all the time you need."
            : "Talk whenever you're ready. Or type, if the house is quiet."}
        </Text>
      </Animated.View>

      {kept ? (
        <Animated.View entering={sealEnter} style={styles.sealRow}>
          <Pressable
            onPress={() => router.push(`/page/${kept.ulid}`)}
            style={styles.sealPress}
            accessibilityRole="button"
            accessibilityLabel="Open the kept entry"
          >
            <MiniLamp
              size={34}
              breathing={reply.status === "thinking" || reply.status === "streaming"}
            />
            <View style={styles.sealText}>
              <Text style={[styles.sealKept, { color: theme.ink }]}>Kept, exactly.</Text>
              <Animated.Text
                key={displayTitle}
                entering={FadeIn.duration(300)}
                style={[styles.sealMeta, { color: theme.inkFaint }]}
                numberOfLines={1}
              >
                {displayTitle}
                {kept.audioUri ? " · spoken" : ""} · in the Ledger
              </Animated.Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      {pending ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.pendingRow}>
          <Pressable onPress={flipPending} hitSlop={10} accessibilityRole="button">
            <View style={[styles.pendingChip, { borderColor: theme.line }]}>
              <Text style={[styles.pendingText, { color: theme.accentDeep }]}>
                {pending.read === "entry" ? "Keeping as an entry ▾" : "Answering it ▾"}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <View style={styles.middle}>
        {askText ? (
          <ScrollView
            style={styles.keptScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: space.s }}
          >
            <AskPanel question={askText} onDone={() => setAskSettled(true)} />
          </ScrollView>
        ) : null}
        {typed === null && !kept && !askText ? (
          <Animated.View exiting={FadeOut.duration(250)} style={styles.lampWrap}>
            <TalkCircle
              onPress={onCirclePress}
              listening={listening}
              volume={micVolume}
              label={listening ? "TAP TO FINISH" : "TAP AND TALK"}
            />
            {listening ? (
              <View style={styles.waveRow}>
                <Waveform volume={state.volume} />
                {state.segments > 0 && !reducedMotion ? (
                  // Each Android segment-restart pulses one ember — the
                  // stitch made visible to us, invisible-but-honest to users.
                  <Animated.View
                    key={state.segments}
                    style={[
                      styles.blip,
                      { backgroundColor: theme.accent },
                      {
                        animationName: { "0%": { opacity: 0.9 }, "100%": { opacity: 0 } },
                        animationDuration: "300ms",
                        animationFillMode: "forwards",
                      },
                    ]}
                  />
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {listening ? (
          <View style={styles.transcriptWrap}>
            {liveText ? (
              <View style={styles.transcriptBox}>
                <ScrollView
                  ref={transcriptRef}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() =>
                    transcriptRef.current?.scrollToEnd({ animated: false })
                  }
                >
                  <Text style={[styles.transcript, { color: theme.ink }]}>
                    {state.finalText}
                    {state.interimText ? (
                      <Text style={{ color: theme.inkSoft }}> {state.interimText}</Text>
                    ) : null}
                  </Text>
                </ScrollView>
                <View style={styles.topFade} pointerEvents="none">
                  <Svg width="100%" height="24">
                    <Defs>
                      <SvgLinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={theme.ground} stopOpacity={1} />
                        <Stop offset="1" stopColor={theme.ground} stopOpacity={0} />
                      </SvgLinearGradient>
                    </Defs>
                    <Rect width="100%" height="24" fill="url(#fade)" />
                  </Svg>
                </View>
              </View>
            ) : null}
            {quiet ? (
              <Animated.Text
                entering={FadeIn.duration(400)}
                style={[styles.quietHint, { color: theme.inkFaint }]}
              >
                take your time — pauses are kept too
              </Animated.Text>
            ) : null}
          </View>
        ) : null}

        {typed !== null ? (
          <Animated.View entering={FadeInDown.duration(360)} style={styles.typedWrap}>
            <Card label="Write it down">
              <TextInput
                value={typed}
                onChangeText={setTyped}
                multiline
                autoFocus
                placeholder="However it comes out is right."
                placeholderTextColor={theme.inkFaint}
                style={[styles.typedInput, { color: theme.ink }]}
              />
            </Card>
            <View style={styles.typedActions}>
              <Pressable onPress={() => setTyped(null)} hitSlop={8}>
                <Text style={[styles.quietAction, { color: theme.inkFaint }]}>Not now</Text>
              </Pressable>
              {/* Even typed words are given to the lamp — it docks as the send action. */}
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setTyped(null);
                  settleCapture(typed, null);
                }}
                hitSlop={8}
                disabled={saving || !typed.trim()}
                accessibilityRole="button"
                accessibilityLabel="Give it to the lamp"
              >
                <View style={{ opacity: saving || !typed.trim() ? 0.45 : 1 }}>
                  <MiniLamp size={56} breathing={saving} />
                </View>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {kept ? (
          <ScrollView
            style={styles.keptScroll}
            contentContainerStyle={{ gap: space.s + 4 }}
            showsVerticalScrollIndicator={false}
          >
            {reply.status !== "idle" && reply.status !== "error" ? (
              <Letter label={reply.text ? "Wovera replies" : "reading your story so far…"}>
                {reply.text ? (
                  <Text style={[styles.replyText, { color: theme.ink }]}>{reply.text}</Text>
                ) : null}
                {reply.text && reply.sources.length > 0 ? (
                  <View style={styles.chipRow}>
                    {reply.sources.map((s) => (
                      <Pressable
                        key={s.ulid}
                        onPress={() => router.push(`/page/${s.ulid}`)}
                        style={[
                          styles.chip,
                          { borderColor: theme.line, backgroundColor: theme.surface2 },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: theme.accentDeep }]}>
                          {s.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Letter>
            ) : null}

            {reply.held.length > 0 ? (
              <View
                style={[
                  styles.heldPanel,
                  { backgroundColor: name === "dusk" ? "#1d241d" : "#e9efe3" },
                ]}
              >
                <Text style={[styles.heldLabel, { color: theme.held }]}>HELD FOR YOU</Text>
                {reply.held.map((h, i) => (
                  <Animated.View
                    key={h.ulid}
                    style={
                      !reducedMotion && {
                        // Seeds plant: 0.8→1, 220ms, staggered 120ms.
                        animationName: {
                          "0%": { transform: [{ scale: 0.8 }], opacity: 0 },
                          "100%": { transform: [{ scale: 1 }], opacity: 1 },
                        },
                        animationDuration: "220ms",
                        animationDelay: `${i * 120}ms`,
                        animationFillMode: "backwards",
                      }
                    }
                  >
                    <Pressable
                      onPress={() => router.push(`/page/${h.ulid}`)}
                      style={styles.heldRow}
                    >
                      <Text style={[styles.heldText, { color: theme.held }]}>
                        ✦ {h.created ? "New page" : "Tended"} — {h.title}
                      </Text>
                    </Pressable>
                  </Animated.View>
                ))}
                <Animated.Text
                  entering={FadeIn.delay(reply.held.length * 120).duration(220)}
                  style={[styles.heldNote, { color: theme.inkFaint }]}
                >
                  Woven into your shelves. Undo any of it from the Ledger.
                </Animated.Text>
              </View>
            ) : null}

            {reply.status === "error" && reply.error ? (
              <Text style={[styles.error, { color: theme.inkSoft }]}>{reply.error}</Text>
            ) : null}
          </ScrollView>
        ) : null}

        {state.error && !kept ? (
          // Once the entry is kept, recognizer hiccups are history — say nothing.
          <Text style={[styles.error, { color: theme.inkSoft }]}>{state.error}</Text>
        ) : null}
      </View>

      {typed === null &&
      !listening &&
      !pending &&
      (!kept || replySettled) &&
      (!askText || askSettled) ? (
        <Pressable
          onPress={() => {
            setKept(null);
            resetReply();
            setAskText(null);
            setAskSettled(false);
            setTyped("");
          }}
          hitSlop={8}
        >
          <Text style={[styles.typeInstead, { color: theme.inkFaint }]}>type instead</Text>
        </Pressable>
      ) : null}
      {(kept && replySettled) || (askText && askSettled) ? (
        <Animated.Text
          entering={FadeIn.duration(400)}
          style={[styles.promise, { color: theme.inkFaint }]}
        >
          the lamp is ready when you are
        </Animated.Text>
      ) : (
        <Animated.View
          style={{
            opacity: listening ? 0.3 : 1,
            transitionProperty: "opacity",
            transitionDuration: "200ms",
          }}
        >
          <Text style={[styles.promise, { color: theme.inkFaint }]}>
            Your words are kept exactly. Nothing is cleaned up unless you ask.
          </Text>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  sub: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 21, marginTop: space.s },
  sealRow: { marginTop: space.m },
  pendingRow: { alignItems: "center", marginTop: space.m },
  pendingChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pendingText: { fontFamily: fonts.uiMedium, fontSize: 13 },
  sealPress: { flexDirection: "row", alignItems: "center", gap: 12 },
  sealText: { flex: 1 },
  sealKept: { fontFamily: fonts.bodyMedium, fontSize: 16 },
  sealMeta: { fontFamily: fonts.ui, fontSize: 12, marginTop: 2 },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.m },
  lampWrap: { alignItems: "center" },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  blip: { width: 6, height: 6, borderRadius: 3 },
  transcriptWrap: { alignSelf: "stretch" },
  transcriptBox: { maxHeight: 240 },
  transcript: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 27,
    paddingTop: 24,
    paddingHorizontal: space.s,
  },
  topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 24 },
  quietHint: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: space.s,
  },
  typedWrap: { alignSelf: "stretch" },
  typedInput: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 140,
    textAlignVertical: "top",
  },
  typedActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.s,
  },
  quietAction: { fontFamily: fonts.uiMedium, fontSize: 14, padding: space.s },
  keptScroll: { alignSelf: "stretch", maxHeight: 420 },
  replyText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25 },
  heldPanel: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15 },
  heldLabel: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.2, marginBottom: 6 },
  heldRow: { paddingVertical: 4 },
  heldText: { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20 },
  heldNote: { fontFamily: fonts.ui, fontSize: 12, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.s },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.uiMedium, fontSize: 12 },
  error: { fontFamily: fonts.ui, fontSize: 13, textAlign: "center" },
  typeInstead: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 6,
  },
  promise: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    textAlign: "center",
    marginBottom: space.l,
  },
});
