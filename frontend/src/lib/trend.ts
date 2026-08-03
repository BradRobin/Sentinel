export type RegistryTrendValue = string | null | undefined;

/** Trend color tone shared by the registry dashboard and the county map. */
export function trendClass(trend: RegistryTrendValue): string {
  switch (trend) {
    case "up":
      return "text-icta-green";
    case "down":
      return "text-icta-red";
    default:
      return "text-icta-gray-600";
  }
}

/** Human trend label ("Up" / "Down" / "Flat" / "—"). */
export function trendLabel(trend: RegistryTrendValue): string {
  switch (trend) {
    case "up":
      return "Up";
    case "down":
      return "Down";
    case "flat":
      return "Flat";
    default:
      return "—";
  }
}
