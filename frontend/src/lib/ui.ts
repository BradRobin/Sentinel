/**
 * Shared interactive chrome — ICTA palette, modern-enterprise feel.
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
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-gray-800";
const focusRed =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-red";

const disabledSolid = "disabled:pointer-events-none disabled:opacity-50";
const disabledGhost = "disabled:pointer-events-none disabled:opacity-40";

/** Solid primary — green with a crisp inset highlight + grounded shadow. */
export const btnPrimary =
  `inline-flex items-center justify-center gap-1.5 rounded-lg bg-icta-green px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_51_0/0.28)] hover:bg-icta-green-deep hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_4px_14px_-4px_rgb(0_102_0/0.5)] active:bg-icta-green-deep ${btnMotion} ${btnPress} ${focusGreen} ${disabledSolid}`;

export const btnPrimaryLg =
  `inline-flex items-center justify-center gap-2 rounded-lg bg-icta-green px-6 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_51_0/0.28)] hover:bg-icta-green-deep hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_8px_20px_-8px_rgb(0_102_0/0.55)] active:bg-icta-green-deep ${btnMotion} ${btnPress} ${focusGreen} ${disabledSolid}`;

/** Solid fail / destructive action — ICTA red. */
export const btnDanger =
  `inline-flex items-center justify-center gap-1.5 rounded-lg bg-icta-red px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(90_0_0/0.28)] hover:bg-icta-red-deep hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_4px_14px_-4px_rgb(139_0_0/0.5)] active:bg-icta-red-deep ${btnMotion} ${btnPress} ${focusRed} ${disabledSolid}`;

export const btnSecondary =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-icta-gray-200 bg-white px-4 py-2 text-sm font-semibold text-icta-gray-800 shadow-card transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:text-icta-gray-900 hover:shadow-card-hover active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack} disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-icta-gray-200 disabled:bg-icta-gray-50 disabled:text-icta-gray-400 disabled:opacity-100`;

export const btnSecondaryLg =
  `inline-flex items-center justify-center gap-2 rounded-lg border border-icta-gray-200 bg-white px-6 py-3 text-sm font-semibold text-icta-gray-800 shadow-card transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:text-icta-gray-900 hover:shadow-card-hover active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70`;

/** Compact outline — compare / retry / filter chips */
export const btnSecondarySm =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-icta-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-icta-gray-700 shadow-card transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:text-icta-gray-900 active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack} disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-icta-gray-200 disabled:bg-icta-gray-50 disabled:font-medium disabled:text-icta-gray-400 disabled:opacity-100`;

export const btnGhost =
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-icta-gray-600 transition-colors hover:bg-icta-gray-100 hover:text-icta-gray-900 active:bg-icta-gray-200 ${btnMotion} ${btnPress} ${focusBlack} ${disabledGhost}`;

/** Compact muted chip — registry Copy, etc. */
export const btnMuted =
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-icta-gray-200 bg-icta-gray-50 px-2.5 py-1.5 text-sm font-medium text-icta-gray-600 transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-100 hover:text-icta-gray-900 active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack}`;

export const btnFilterIdle =
  `inline-flex items-center justify-center gap-1.5 rounded-full border border-icta-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-icta-gray-600 shadow-card transition-colors hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:text-icta-gray-900 active:bg-icta-gray-100 ${btnMotion} ${btnPress} ${focusBlack}`;

export const btnFilterActive =
  `inline-flex items-center justify-center gap-1.5 rounded-full bg-icta-gray-900 px-3 py-1.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-icta-gray-800 active:bg-icta-gray-800 ${btnMotion} ${btnPress} ${focusBlack}`;

/** Icon-only square button — hamburger, close, refresh. */
export const iconBtn =
  `inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-icta-gray-600 transition-colors hover:bg-icta-gray-100 hover:text-icta-gray-900 active:bg-icta-gray-200 ${btnMotion} ${btnPress} ${focusBlack}`;

export const inputBase =
  "w-full rounded-lg border border-icta-gray-200 bg-white px-3 py-2 text-sm text-icta-gray-900 shadow-card transition-[border-color,box-shadow,background-color] placeholder:text-icta-gray-400 focus:border-icta-green/60 focus:outline-none focus:ring-4 focus:ring-icta-green/10 disabled:cursor-not-allowed disabled:bg-icta-gray-50 disabled:text-icta-gray-400";

export const inputError = "border-icta-red/70 focus:border-icta-red focus:ring-icta-red/10";

export const linkQuiet =
  "text-sm text-icta-gray-600 transition-colors hover:text-icta-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-gray-800";

/** Inline text link — standards clause links, narrative "view" links. */
export const textLink =
  "text-icta-link underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-link";

/** Underline + hover behaviour shared by coloured inline links (donut legend, etc.). */
export const linkUnderline =
  "underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-link";

export const panelBackdrop =
  "fixed inset-0 z-40 bg-icta-gray-900/25 backdrop-blur-[2px] transition-opacity";

export const panelShell =
  "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-icta-gray-200 bg-white shadow-pop transition-transform duration-300 ease-out motion-reduce:transition-none sm:rounded-l-2xl";

export const panelHeader =
  "flex items-start justify-between gap-4 border-b border-icta-gray-200 bg-white px-5 py-4";

/** Shared surface — matches `.card` in globals.css (kept as a Tailwind string so it can be used alongside other utilities). */
export const card = "rounded-xl border border-icta-gray-200 bg-white shadow-card";

/** Card + lift-on-hover behaviour. */
export const cardHover = `${card} card-hover`;

/** Workspace panel — the shared "section surface" used across pages. */
export const sectionPanel = "section-panel";

/** Small tracked label above a heading. */
export const eyebrow = "eyebrow";

/** Field label text. */
export const fieldLabel = "mb-1.5 block text-sm font-medium text-icta-gray-800";

/** Muted metadata text — timestamps, captions, secondary numbers. */
export const meta = "text-xs text-icta-gray-500";

/** Section heading inside a panel — small caps label. */
export const sectionLabel = "text-xs font-semibold uppercase tracking-wide text-icta-gray-500";

/** Status badge tones (pill). Neutral first, then semantic. */
const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium";

export const badgeNeutral = `${badgeBase} bg-icta-gray-100 text-icta-gray-600`;
export const badgeGreen = `${badgeBase} bg-icta-green-tint text-icta-green-deep`;
export const badgeRed = `${badgeBase} bg-icta-red-tint text-icta-red-deep`;
export const badgeAmber = `${badgeBase} bg-icta-amber-tint text-icta-amber-deep`;
export const badgeInfo = `${badgeBase} bg-icta-info-tint text-icta-link`;

/** Soft icon tile — circular tinted dish for icons inside cards/lists. */
export const iconTile =
  "flex size-10 shrink-0 items-center justify-center rounded-xl bg-icta-gray-100 text-icta-gray-700 ring-1 ring-inset ring-icta-gray-200/70";

export const iconTileGreen = "bg-icta-green-tint text-icta-green-deep ring-icta-green/15";
export const iconTileRed = "bg-icta-red-tint text-icta-red-deep ring-icta-red/15";
export const iconTileAmber = "bg-icta-amber-tint text-icta-amber-deep ring-icta-amber/15";
export const iconTileInfo = "bg-icta-info-tint text-icta-link ring-icta-link/15";
