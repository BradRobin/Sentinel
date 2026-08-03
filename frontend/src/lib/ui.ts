/**
 * Shared interactive chrome — ICTA palette, minimal states.
 * Prefer these over one-off button/input class strings.
 */

/** Base motion for interactive chrome: colour + shadow + press transform. */
const btnMotion =
  "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none";

/** Base press feedback shared by solid buttons. Reduced "bounce" for institutional feel. */
const btnPress = "active:bg-opacity-90 motion-reduce:active:bg-opacity-100";

const focusGreen =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-green";
const focusBlack =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black";
const focusRed =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-red";

const disabledSolid =
  "disabled:pointer-events-none disabled:opacity-50";
const disabledGhost =
  "disabled:pointer-events-none disabled:opacity-40";

export const btnPrimary =
  `inline-flex items-center justify-center gap-1.5 rounded-md bg-icta-green px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.15)] hover:bg-icta-green/90 hover:shadow-[0_4px_12px_-4px_rgb(0_0_0/0.3)] active:bg-icta-green/80 ${btnMotion} ${btnPress} ${focusGreen} ${disabledSolid}`;

export const btnPrimaryLg =
  `inline-flex items-center justify-center gap-2 rounded-md bg-icta-green px-6 py-3 text-sm font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.15)] hover:bg-icta-green/90 hover:shadow-[0_8px_20px_-8px_rgb(0_0_0/0.4)] active:bg-icta-green/80 ${btnMotion} ${btnPress} ${focusGreen} ${disabledSolid}`;

/** Solid fail / destructive action — ICTA red (#bb0000). */
export const btnDanger =
  `inline-flex items-center justify-center gap-1.5 rounded-md bg-icta-red px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.15)] hover:bg-icta-red/90 hover:shadow-[0_4px_12px_-4px_rgb(139_0_0/0.4)] active:bg-icta-red/80 ${btnMotion} ${btnPress} ${focusRed} ${disabledSolid}`;

export const btnSecondary =
  `inline-flex items-center justify-center gap-1.5 rounded-md border border-icta-gray-200 bg-white px-4 py-2 text-sm font-semibold text-icta-black transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:shadow-[0_4px_12px_-8px_rgb(0_0_0/0.25)] active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack} disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-icta-gray-200 disabled:bg-icta-gray-50 disabled:text-icta-gray-600 disabled:opacity-70`;

export const btnSecondaryLg =
  `inline-flex items-center justify-center gap-2 rounded-md border border-icta-gray-200 bg-white px-6 py-3 text-sm font-semibold text-icta-black transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:shadow-[0_6px_16px_-10px_rgb(0_0_0/0.3)] active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70`;

/** Compact outline — compare / retry / filter chips */
export const btnSecondarySm =
  `inline-flex items-center justify-center gap-1.5 rounded-md border border-icta-gray-200 px-3 py-1.5 text-sm font-semibold text-icta-black transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack} disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-icta-gray-200 disabled:bg-icta-gray-50 disabled:font-medium disabled:text-icta-gray-600 disabled:opacity-70`;

export const btnGhost =
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-black active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack} ${disabledGhost}`;

/** Compact muted chip — registry Copy, etc. */
export const btnMuted =
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-icta-gray-200 bg-icta-gray-50 px-2.5 py-1.5 text-sm font-medium text-icta-gray-600 transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-100 hover:text-icta-black active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack}`;

export const btnFilterIdle =
  `inline-flex items-center justify-center gap-1.5 rounded-full border border-icta-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-icta-gray-600 transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:text-icta-black active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack}`;

export const btnFilterActive =
  `inline-flex items-center justify-center gap-1.5 rounded-full bg-icta-black px-3 py-1.5 text-sm font-medium text-white shadow-[0_2px_6px_-2px_rgb(0_0_0/0.4)] transition-colors hover:bg-icta-black/90 active:bg-icta-black/80 ${btnMotion} ${btnPress} ${focusBlack}`;

/** Icon-only square button — hamburger, close, refresh. */
export const iconBtn =
  `inline-flex size-8 shrink-0 items-center justify-center rounded-md text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-black active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack}`;

export const inputBase =
  "w-full rounded-md border border-icta-gray-200 bg-white px-3 py-2 text-sm text-icta-black transition-[border-color,box-shadow,background-color] placeholder:text-icta-gray-600/60 focus:border-icta-black focus:outline-none focus:ring-2 focus:ring-icta-black/10 disabled:cursor-not-allowed disabled:bg-icta-gray-50 disabled:text-icta-gray-600";

export const inputError =
  "border-icta-red focus:border-icta-red focus:ring-icta-red/15";

export const linkQuiet =
  "text-sm text-icta-gray-600 transition-colors hover:text-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black";

/** Inline text link — standards clause links, narrative "view" links. */
export const textLink =
  "text-icta-link underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-link";

/** Underline + hover behaviour shared by coloured inline links (donut legend, etc.). */
export const linkUnderline =
  "underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-link";

export const panelBackdrop =
  "fixed inset-0 z-40 bg-icta-black/20 backdrop-blur-[2px] transition-opacity";

export const panelShell =
  "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-icta-gray-200 bg-white shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none";

export const panelHeader =
  "flex items-start justify-between gap-4 border-b border-icta-gray-200 bg-white px-5 py-4";

/** Shared surface — matches `.card` in globals.css (kept as a Tailwind string so it can be used alongside other utilities). */
export const card =
  "rounded-lg border border-icta-gray-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.05)]";

/** Card + lift-on-hover behaviour. Now grounded. */
export const cardHover = `${card} card-hover`;
