"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import {
  a11ySubscribe,
  applyA11yToDocument,
  bumpTextStep,
  prefsAreDefault,
  readA11yPrefs,
  readA11yPrefsServer,
  resetA11yPrefs,
  setA11yPrefs,
  textStepScale,
  type A11yPrefs,
} from "@/lib/a11y";
import { btnGhost, btnSecondarySm } from "@/lib/ui";

type ToolAction =
  | { kind: "text-up" }
  | { kind: "text-down" }
  | { kind: "toggle"; key: keyof Omit<A11yPrefs, "textStep">; label: string }
  | { kind: "reset" };

const TOGGLE_TOOLS: Array<{
  key: keyof Omit<A11yPrefs, "textStep">;
  label: string;
  hint?: string;
}> = [
  { key: "grayscale", label: "Grayscale", hint: "Map score colors may look muted" },
  { key: "highContrast", label: "High Contrast" },
  { key: "negativeContrast", label: "Negative Contrast" },
  { key: "lightBackground", label: "Light Background" },
  { key: "underlineLinks", label: "Links Underline" },
  { key: "readableFont", label: "Readable Font" },
];

function AccessIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2.25" />
      <path d="M12 7.5v4.5" />
      <path d="M7 10.5h10" />
      <path d="M12 12l-3.5 8" />
      <path d="M12 12l3.5 8" />
    </svg>
  );
}

function ToolIcon({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "size-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "text-up":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16.5 16.5L21 21" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      );
    case "text-down":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16.5 16.5L21 21" />
          <path d="M8 11h6" />
        </svg>
      );
    case "grayscale":
      return (
        <svg {...common}>
          <path d="M6 5v14M10 5v14M14 5v14M18 5v14" />
        </svg>
      );
    case "highContrast":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5a7 7 0 0 1 0 14V5Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "negativeContrast":
      return (
        <svg {...common}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "lightBackground":
      return (
        <svg {...common}>
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a5 5 0 0 1 3.5 8.4c-.6.6-.9 1.3-1 2.1H9.5c-.1-.8-.4-1.5-1-2.1A5 5 0 0 1 12 3Z" />
        </svg>
      );
    case "underlineLinks":
      return (
        <svg {...common}>
          <path d="M8 13a4 4 0 0 0 0 5.5h0a4 4 0 0 0 5.5 0L15 17" />
          <path d="M16 11a4 4 0 0 0 0-5.5h0A4 4 0 0 0 10.5 5.5L9 7" />
        </svg>
      );
    case "readableFont":
      return (
        <svg {...common}>
          <path d="M5 19V6l7 12 7-12v13" />
        </svg>
      );
    case "reset":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      );
    default:
      return null;
  }
}

function runAction(action: ToolAction) {
  switch (action.kind) {
    case "text-up":
      bumpTextStep(1);
      break;
    case "text-down":
      bumpTextStep(-1);
      break;
    case "toggle":
      setA11yPrefs({ [action.key]: !readA11yPrefs()[action.key] });
      break;
    case "reset":
      resetA11yPrefs();
      break;
  }
}

export function AccessibilityTools() {
  const panelId = useId();
  const liveId = useId();
  const prefs = useSyncExternalStore(
    a11ySubscribe,
    readA11yPrefs,
    readA11yPrefsServer,
  );
  const [open, setOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // Apply stored prefs after mount (boot script already ran for no-flash).
  useEffect(() => {
    applyA11yToDocument(readA11yPrefs());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        fabRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function announceAndRun(message: string, action: ToolAction) {
    runAction(action);
    const next = readA11yPrefs();
    if (action.kind === "text-up" || action.kind === "text-down") {
      setAnnounce(
        `Text size ${Math.round(textStepScale(next.textStep) * 100)} percent`,
      );
    } else {
      setAnnounce(message);
    }
  }

  const scalePct = Math.round(textStepScale(prefs.textStep) * 100);
  const atMinText = prefs.textStep <= -2;
  const atMaxText = prefs.textStep >= 2;

  return (
    <div className="a11y-widget pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
      <div id={liveId} className="sr-only" aria-live="polite">
        {announce}
      </div>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-label="Accessibility Tools"
        aria-hidden={!open}
        inert={open ? undefined : true}
        className={`pointer-events-auto w-[16.5rem] origin-bottom-right overflow-hidden rounded-md border border-icta-gray-200 bg-white motion-reduce:transition-none ${
          open
            ? "scale-100 opacity-100 transition duration-200"
            : "pointer-events-none scale-95 opacity-0 transition duration-150"
        }`}
      >
        <div className="flex items-center justify-between border-b border-icta-gray-200 px-3 py-2.5">
          <p className="text-sm font-semibold text-icta-black">
            Accessibility Tools
          </p>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setOpen(false);
              fabRef.current?.focus();
            }}
          >
            Close
          </button>
        </div>

        <ul className="divide-y divide-icta-gray-100 py-1">
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-icta-black hover:bg-icta-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={atMaxText}
              onClick={() =>
                announceAndRun(`Text size ${Math.min(scalePct + 12, 125)} percent`, {
                  kind: "text-up",
                })
              }
            >
              <ToolIcon name="text-up" />
              <span className="flex-1 font-medium">Increase Text</span>
              <span className="text-xs text-icta-gray-600">{scalePct}%</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-icta-black hover:bg-icta-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={atMinText}
              onClick={() =>
                announceAndRun(`Text size ${Math.max(scalePct - 6, 87)} percent`, {
                  kind: "text-down",
                })
              }
            >
              <ToolIcon name="text-down" />
              <span className="flex-1 font-medium">Decrease Text</span>
            </button>
          </li>

          {TOGGLE_TOOLS.map((tool) => {
            const active = prefs[tool.key];
            return (
              <li key={tool.key}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-icta-gray-50 ${
                    active ? "bg-icta-green/5 text-icta-black" : "text-icta-black"
                  }`}
                  aria-pressed={active}
                  onClick={() =>
                    announceAndRun(
                      `${tool.label} ${active ? "off" : "on"}`,
                      { kind: "toggle", key: tool.key, label: tool.label },
                    )
                  }
                >
                  <ToolIcon name={tool.key} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{tool.label}</span>
                    {tool.hint && active ? (
                      <span className="mt-0.5 block text-xs text-icta-gray-600">
                        {tool.hint}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <span className="text-xs font-semibold text-icta-green">On</span>
                  ) : null}
                </button>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-icta-black hover:bg-icta-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={prefsAreDefault(prefs)}
              onClick={() => announceAndRun("Accessibility settings reset", { kind: "reset" })}
            >
              <ToolIcon name="reset" />
              <span className="flex-1 font-medium">Reset</span>
            </button>
          </li>
        </ul>

        <div className="border-t border-icta-gray-200 px-3 py-2">
          <p className="text-xs text-icta-gray-600">
            Preferences stay on this device. High Contrast and Negative Contrast
            cannot be on together.
          </p>
        </div>
      </div>

      <button
        ref={fabRef}
        type="button"
        className={`${btnSecondarySm} pointer-events-auto size-11 !rounded-md !p-0 shadow-sm`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close accessibility tools" : "Open accessibility tools"}
        onClick={() => setOpen((v) => !v)}
      >
        <AccessIcon className="size-5 text-icta-green" />
      </button>
    </div>
  );
}
