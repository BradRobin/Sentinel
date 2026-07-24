"use client";

import { useEffect, useState } from "react";

const TYPE_MS = 42;
const DELETE_MS = 28;
const HOLD_MS = 1600;
const GAP_MS = 400;

interface TypingPlaceholderProps {
  examples: readonly string[];
  /** When false, the overlay is hidden (focus / typed value / busy). */
  active: boolean;
  className?: string;
}

/**
 * Animated “typing” placeholder for empty, unfocused inputs.
 * Cycles through example strings; respects prefers-reduced-motion.
 */
export function TypingPlaceholder({
  examples,
  active,
  className = "",
}: TypingPlaceholderProps) {
  const [text, setText] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active || examples.length === 0) {
      setText("");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let index = 0;

    const schedule = (fn: () => void, ms: number) => {
      timer = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    if (reduceMotion) {
      setText(examples[0] ?? "");
      const rotate = () => {
        index = (index + 1) % examples.length;
        setText(examples[index] ?? "");
        schedule(rotate, HOLD_MS + GAP_MS);
      };
      schedule(rotate, HOLD_MS + GAP_MS);
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    let char = 0;
    let deleting = false;

    const tick = () => {
      const full = examples[index] ?? "";
      if (!deleting) {
        char += 1;
        setText(full.slice(0, char));
        if (char >= full.length) {
          deleting = true;
          schedule(tick, HOLD_MS);
          return;
        }
        schedule(tick, TYPE_MS);
        return;
      }

      char -= 1;
      setText(full.slice(0, Math.max(0, char)));
      if (char <= 0) {
        deleting = false;
        index = (index + 1) % examples.length;
        schedule(tick, GAP_MS);
        return;
      }
      schedule(tick, DELETE_MS);
    };

    schedule(tick, GAP_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, examples, reduceMotion]);

  if (!active) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 text-sm text-icta-gray-600/70 ${className}`}
      aria-hidden="true"
    >
      <span className="truncate">
        {text}
        <span
          className="ml-0.5 inline-block h-[1.05em] w-px animate-pulse bg-current align-[-0.15em]"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
