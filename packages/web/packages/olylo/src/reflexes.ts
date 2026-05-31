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
  const lastActivity = useRef(0);
  useEffect(() => {
    lastActivity.current = Date.now();
    const bump = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("pointermove", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("pointerdown", bump);
    const poll = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      const next: Ladder =
        idle > ASLEEP_AFTER_MS ? "asleep" : idle > BORED_AFTER_MS ? "bored" : "active";
      setLadder((prev) => (prev === next ? prev : next));
    }, 400);
    return () => {
      clearInterval(poll);
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("pointerdown", bump);
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
