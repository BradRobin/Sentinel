"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  CHECK_NUMS,
  RIBBON_NUMS,
  RIBBON_PATH,
  SentinelMarkState,
  buildPath,
  easeInOutCubic,
  lerp,
} from "@/lib/sentinel-mark-paths";

export interface SentinelMarkProps {
  state: SentinelMarkState;
  size?: number;
  className?: string;
  /** Accessible label; defaults by state */
  label?: string;
}

const MORPH_DURATION_MS = 900;
const GREEN = "var(--icta-green)";

export function SentinelMark({
  state,
  size = 160,
  className = "",
  label,
}: SentinelMarkProps) {
  const rawId = useId();
  const gradientId = `sentinel-tricolor-${rawId.replace(/:/g, "")}`;
  const pathRef = useRef<SVGPathElement>(null);
  const rafRef = useRef<number | null>(null);
  const prevStateRef = useRef<SentinelMarkState>(state);
  const [popping, setPopping] = useState(false);
  const [pathD, setPathD] = useState(RIBBON_PATH);
  const [stroke, setStroke] = useState(`url(#${gradientId})`);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const cancelMorph = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const resetRibbon = () => {
    cancelMorph();
    setPathD(RIBBON_PATH);
    setStroke(`url(#${gradientId})`);
    setPopping(false);
  };

  const morphToCheck = (instant: boolean) => {
    cancelMorph();
    if (instant) {
      setPathD(buildPath(CHECK_NUMS));
      setStroke(GREEN);
      return;
    }

    const start = performance.now();
    const frame = (now: number) => {
      const raw = Math.min((now - start) / MORPH_DURATION_MS, 1);
      const t = easeInOutCubic(raw);
      setPathD(buildPath(lerp(RIBBON_NUMS, CHECK_NUMS, t)));
      if (raw >= 0.85) {
        setStroke(GREEN);
      }
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        setPopping(true);
        window.setTimeout(() => setPopping(false), 400);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (state === "complete") {
      const instant = reducedMotion || prev === "complete";
      morphToCheck(instant);
      return;
    }

    resetRibbon();
    return cancelMorph;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reducedMotion, gradientId]);

  const wrapClass = [
    "sentinel-mark",
    `sentinel-mark--${state}`,
    popping ? "sentinel-mark--pop" : "",
    reducedMotion ? "sentinel-mark--reduced" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel =
    label ??
    (state === "idle"
      ? "Sentinel mark — ready"
      : state === "processing"
        ? "Sentinel mark — loading"
        : "Sentinel mark — complete");

  return (
    <div
      className={wrapClass}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--icta-red)" />
            <stop offset="50%" stopColor="var(--icta-black)" />
            <stop offset="100%" stopColor="var(--icta-green)" />
          </linearGradient>
        </defs>
        <g className="sentinel-mark__ribbon-group">
          <path
            ref={pathRef}
            className="sentinel-mark__ribbon-path"
            d={pathD}
            fill="none"
            stroke={stroke}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
