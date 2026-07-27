"use client";

import dynamic from "next/dynamic";

const KenyaMapDashboard = dynamic(
  () =>
    import("@/components/KenyaMapDashboard").then((m) => m.KenyaMapDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center px-6 py-24 text-sm text-icta-gray-600">
        Loading map…
      </div>
    ),
  },
);

export function KenyaMapDashboardClient() {
  return <KenyaMapDashboard />;
}
