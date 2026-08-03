"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  CHECK_DASH,
  CHECK_PATH,
  RIBBON_PATH,
  WIND_INTO_ANCHOR,
  easeOutCubic,
  type SentinelMarkState,
} from "@/lib/sentinel-mark-paths";

export interface SentinelMarkProps {
  state: SentinelMarkState;
  size?: number;
  className?: string;
  /** Accessible label; defaults by state */
  label?: string;
}

/** Logo settle / check green — matches the --icta-green theme token. */
const MARK_GREEN = "#006600";
const ERROR_STROKE = "var(--icta-gray-600)";

export function SentinelMark({
  state,
  size = 160,
  className = "",
  label,
}: SentinelMarkProps) {
  const rawId = useId();
  const gradientId = `sentinel-tricolor-${rawId.replace(/:/g, "")}`;
  const ribbonRef = useRef<SVGPathElement>(null);
  const checkRef = useRef<SVGPathElement>(null);
  const rafRef = useRef<number | null>(null);
  const checkTimeoutRef = useRef<number | null>(null);
  const popTimeoutRef = useRef<number | null>(null);
  const prevStateRef = useRef<SentinelMarkState>(state);
  const [popping, setPopping] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const clearTimers = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (checkTimeoutRef.current !== null) {
      window.clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }
    if (popTimeoutRef.current !== null) {
      window.clearTimeout(popTimeoutRef.current);
      popTimeoutRef.current = null;
    }
  };

  const setCheckHidden = (instant: boolean) => {
    const check = checkRef.current;
    if (!check) return;
    if (instant) check.classList.add("sentinel-mark__check-path--no-transition");
    else check.classList.remove("sentinel-mark__check-path--no-transition");
    check.style.strokeDashoffset = String(CHECK_DASH);
  };

  const setCheckDrawn = (instant: boolean) => {
    const check = checkRef.current;
    if (!check) return;
    if (instant) {
      check.classList.add("sentinel-mark__check-path--no-transition");
      check.style.strokeDashoffset = "0";
      return;
    }
    check.classList.add("sentinel-mark__check-path--no-transition");
    check.style.strokeDashoffset = String(CHECK_DASH);
    void check.getBoundingClientRect();
    check.classList.remove("sentinel-mark__check-path--no-transition");
    check.style.strokeDashoffset = "0";
  };

  const applyRibbonSettled = () => {
    const ribbon = ribbonRef.current;
    if (!ribbon) return;
    const { totalDegrees, endScale, endStrokeWidth } = WIND_INTO_ANCHOR;
    ribbon.style.transform = `rotate(${totalDegrees}deg) scale(${endScale})`;
    ribbon.setAttribute("stroke", MARK_GREEN);
    ribbon.setAttribute("stroke-width", String(endStrokeWidth));
  };

  const resetRibbon = (strokeValue?: string) => {
    clearTimers();
    const ribbon = ribbonRef.current;
    if (ribbon) {
      ribbon.style.transform = "";
      ribbon.setAttribute(
        "stroke",
        strokeValue ?? `url(#${gradientId})`,
      );
      ribbon.setAttribute(
        "stroke-width",
        String(WIND_INTO_ANCHOR.startStrokeWidth),
      );
    }
    setCheckHidden(true);
    setPopping(false);
  };

  const windIntoAnchor = (duration: number, onDone: () => void) => {
    const ribbon = ribbonRef.current;
    if (!ribbon) return;
    const {
      totalDegrees,
      endScale,
      startStrokeWidth,
      endStrokeWidth,
    } = WIND_INTO_ANCHOR;
    const start = performance.now();

    const frame = (now: number) => {
      const raw = Math.min((now - start) / duration, 1);
      const t = easeOutCubic(raw);
      const deg = totalDegrees * t;
      const scale = 1 - (1 - endScale) * t;
      const width =
        startStrokeWidth - (startStrokeWidth - endStrokeWidth) * t;
      ribbon.style.transform = `rotate(${deg}deg) scale(${scale})`;
      ribbon.setAttribute("stroke-width", width.toFixed(2));
      if (raw >= 0.8) {
        ribbon.setAttribute("stroke", MARK_GREEN);
      }
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const playComplete = (instant: boolean) => {
    clearTimers();
    if (instant) {
      applyRibbonSettled();
      setCheckDrawn(true);
      return;
    }

    const ribbon = ribbonRef.current;
    if (ribbon) {
      ribbon.style.transform = "";
      ribbon.setAttribute("stroke", `url(#${gradientId})`);
      ribbon.setAttribute(
        "stroke-width",
        String(WIND_INTO_ANCHOR.startStrokeWidth),
      );
    }
    setCheckHidden(true);

    windIntoAnchor(WIND_INTO_ANCHOR.durationMs, () => {
      checkTimeoutRef.current = window.setTimeout(() => {
        setCheckDrawn(false);
        checkTimeoutRef.current = window.setTimeout(() => {
          setPopping(true);
          popTimeoutRef.current = window.setTimeout(() => {
            setPopping(false);
            popTimeoutRef.current = null;
          }, 400);
          checkTimeoutRef.current = null;
        }, WIND_INTO_ANCHOR.checkDrawMs);
      }, WIND_INTO_ANCHOR.checkDelayMs);
    });
  };

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (state === "complete") {
      const instant = reducedMotion || prev === "complete";
      playComplete(instant);
      return clearTimers;
    }

    if (state === "error") {
      resetRibbon(ERROR_STROKE);
      return clearTimers;
    }

    resetRibbon();
    return clearTimers;
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
        : state === "error"
          ? "Sentinel mark — error"
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
            <stop offset="0%" stopColor="#BB0000" />
            <stop offset="50%" stopColor="#111111" />
            <stop offset="100%" stopColor={MARK_GREEN} />
          </linearGradient>
        </defs>
        <g className="sentinel-mark__ribbon-group">
          <path
            ref={ribbonRef}
            className="sentinel-mark__ribbon-path"
            d={RIBBON_PATH}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={WIND_INTO_ANCHOR.startStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={state === "error" ? 0.55 : 1}
          />
        </g>
        <path
          ref={checkRef}
          className="sentinel-mark__check-path sentinel-mark__check-path--no-transition"
          d={CHECK_PATH}
          fill="none"
          stroke={MARK_GREEN}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_DASH}
          style={{ strokeDashoffset: CHECK_DASH }}
        />
      </svg>
    </div>
  );
}
