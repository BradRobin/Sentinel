import { Suspense } from "react";

import { KenyaMapDashboardClient } from "@/components/KenyaMapDashboardClient";

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-6 py-24 text-sm text-icta-gray-600">
          Loading map…
        </div>
      }
    >
      <KenyaMapDashboardClient />
    </Suspense>
  );
}
