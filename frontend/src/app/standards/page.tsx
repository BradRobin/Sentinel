import { Suspense } from "react";

import { StandardsViewer } from "@/components/StandardsViewer";

export default function StandardsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-sm text-icta-gray-600">
          Loading standard…
        </div>
      }
    >
      <StandardsViewer />
    </Suspense>
  );
}
