"use client";

import { useEffect, useRef, useState } from "react";
import { POSES } from "./expressions";
import type { OlyloExpression } from "./expressions";

const BLINK_DURATION_MS = 130;
const MIN_BLINK_MS = 2800;
const MAX_BLINK_MS = 7000;
const BORED_AFTER_MS = 6000;
const ASLEEP_AFTER_MS = 14000;
const SLEEP_MUTTER_MS = 5500;
// Typing is a stronger signal than a stray pointer twitch: after the user types,
// olylo stays awake and curious this long before he's allowed to drift off again.
const ALERT_AFTER_TYPING_MS = 30000;

export type Ladder = "active" | "bored" | "asleep";

/** Random eye-blink that pauses when the eyes are meant to stay shut. */
export function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setBlinking(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = MIN_BLINK_MS + Math.random() * (MAX_BLINK_MS - MIN_BLINK_MS);
      timer = setTimeout(() => {
        setBlinking(true);
        timer = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, BLINK_DURATION_MS);
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled]);
  return blinking;
}

/**
 * Inactivity ladder: active → bored → asleep, reset by any pointer/key activity
 * (or a deliberate expression). No driver needed — olylo's own reflex.
 */
export function useIdleLadder(expressionActive: boolean): Ladder {
  const [ladder, setLadder] = useState<Ladder>("active");
  const ladderRef = useRef<Ladder>("active");
  ladderRef.current = ladder; // current state for the move handler to read
  const lastActivity = useRef(0);
  const alertUntil = useRef(0); // typing pins him awake until this time
  useEffect(() => {
    lastActivity.current = Date.now();
    // Mouse movement rouses him — UNLESS he's fully asleep, in which case a stray
    // hover shouldn't wake him; only a click or a keystroke does.
    const move = () => {
      if (ladderRef.current === "asleep") return;
      lastActivity.current = Date.now();
    };
    const wake = () => {
      lastActivity.current = Date.now();
    };
    // Typing also opens a grace window so he doesn't get bored/sleepy right after.
    const typed = () => {
      lastActivity.current = Date.now();
      alertUntil.current = Date.now() + ALERT_AFTER_TYPING_MS;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", typed);
    window.addEventListener("pointerdown", wake);
    const poll = setInterval(() => {
      const now = Date.now();
      // During the post-typing grace, hold him alert and keep resetting the idle
      // clock, so when it lapses he resumes looking-around (not straight to sleep).
      if (now < alertUntil.current) lastActivity.current = now;
      const idle = now - lastActivity.current;
      const next: Ladder =
        idle > ASLEEP_AFTER_MS ? "asleep" : idle > BORED_AFTER_MS ? "bored" : "active";
      setLadder((prev) => (prev === next ? prev : next));
    }, 400);
    return () => {
      clearInterval(poll);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", typed);
      window.removeEventListener("pointerdown", wake);
    };
  }, []);
  useEffect(() => {
    if (expressionActive) lastActivity.current = Date.now();
  }, [expressionActive]);
  return ladder;
}

/** A short utterance emitted when the mood changes (and on a loop while asleep). */
export function useSpeech(effective: OlyloExpression): { text: string; id: number } | null {
  const [speech, setSpeech] = useState<{ text: string; id: number } | null>(null);
  const nextId = useRef(0);
  useEffect(() => {
    const lines = POSES[effective].sayings;
    if (lines.length === 0) {
      setSpeech(null);
      return;
    }
    const emit = () => {
      const text = lines[Math.floor(Math.random() * lines.length)] ?? lines[0]!;
      nextId.current += 1;
      setSpeech({ text, id: nextId.current });
    };
    emit();
    if (effective === "asleep") {
      const loop = setInterval(emit, SLEEP_MUTTER_MS);
      return () => clearInterval(loop);
    }
    return undefined;
  }, [effective]);
  return speech;
}
