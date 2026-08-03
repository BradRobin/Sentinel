"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/Skeleton";

const KenyaMapDashboard = dynamic(
  () =>
    import("@/components/KenyaMapDashboard").then((m) => m.KenyaMapDashboard),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex flex-1 items-center justify-center px-6 py-24"
        role="status"
        aria-busy="true"
      >
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-4 w-1/2 rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      </div>
    ),
  },
);

export function KenyaMapDashboardClient() {
  return <KenyaMapDashboard />;
}
