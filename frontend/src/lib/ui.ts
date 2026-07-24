/**
 * Shared interactive chrome — ICTA palette, minimal states.
 * Prefer these over one-off button/input class strings.
 */

export const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-icta-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-icta-red/90 active:bg-icta-red/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-red disabled:pointer-events-none disabled:opacity-50";

export const btnPrimaryLg =
  "inline-flex items-center justify-center rounded-md bg-icta-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-icta-red/90 active:bg-icta-red/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-red disabled:pointer-events-none disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-md border border-icta-gray-200 bg-white px-4 py-2 text-sm font-semibold text-icta-black transition-colors hover:bg-icta-gray-50 active:bg-icta-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-icta-gray-200 disabled:bg-icta-gray-50 disabled:text-icta-gray-600 disabled:opacity-70";

export const btnSecondaryLg =
  "inline-flex items-center justify-center rounded-md border border-icta-gray-200 bg-white px-6 py-3 text-sm font-semibold text-icta-black transition-colors hover:bg-icta-gray-50 active:bg-icta-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70";

/** Compact outline — compare / retry / filter chips */
export const btnSecondarySm =
  "inline-flex items-center justify-center rounded-md border border-icta-black px-3 py-1.5 text-sm font-semibold text-icta-black transition-colors hover:bg-icta-gray-50 active:bg-icta-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-icta-gray-200 disabled:bg-icta-gray-50 disabled:font-medium disabled:text-icta-gray-600 disabled:opacity-70";

export const btnGhost =
  "inline-flex shrink-0 items-center justify-center rounded-md px-2.5 py-1.5 text-sm font-medium text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-black active:bg-icta-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black";

export const btnFilterIdle =
  "inline-flex items-center justify-center rounded-md border border-icta-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-icta-gray-600 transition-colors hover:bg-icta-gray-50 active:bg-icta-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black";

export const btnFilterActive =
  "inline-flex items-center justify-center rounded-md bg-icta-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-icta-black/90 active:bg-icta-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black";

export const inputBase =
  "w-full rounded-md border border-icta-gray-200 bg-white px-3 py-2 text-sm text-icta-black transition-[border-color,box-shadow,background-color] placeholder:text-icta-gray-600/60 focus:border-icta-black focus:outline-none focus:ring-2 focus:ring-icta-black/10 disabled:cursor-not-allowed disabled:bg-icta-gray-50 disabled:text-icta-gray-600";

export const inputError =
  "border-icta-red focus:border-icta-red focus:ring-icta-red/15";

export const linkQuiet =
  "text-sm text-icta-gray-600 transition-colors hover:text-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black";

export const panelBackdrop =
  "fixed inset-0 z-40 bg-icta-black/20 transition-opacity";

export const panelShell =
  "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-icta-gray-200 bg-white shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none";

export const panelHeader =
  "flex items-start justify-between gap-4 border-b border-icta-gray-200 bg-white px-5 py-4";
