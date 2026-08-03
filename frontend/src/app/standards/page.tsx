import { Suspense } from "react";

import { StandardsViewer } from "@/components/StandardsViewer";
import { Skeleton } from "@/components/Skeleton";

export default function StandardsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex flex-1 items-center justify-center px-6 py-16"
          role="status"
          aria-busy="true"
        >
          <div className="w-full max-w-3xl space-y-3">
            <Skeleton className="h-4 w-1/3 rounded-md" />
            <Skeleton className="h-96 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
        </div>
      }
    >
      <StandardsViewer />
    </Suspense>
  );
}
