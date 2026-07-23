import Link from "next/link";

import { SentinelMark } from "@/components/SentinelMark";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-24">
        <div className="max-w-2xl text-center">
          <div className="mb-6 flex justify-center">
            <SentinelMark state="idle" size={140} />
          </div>
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-icta-gray-600">
            ICT Authority, Kenya
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-icta-black sm:text-5xl">
            Sentinel
          </h1>
          <p className="mb-2 text-lg text-icta-gray-600">
            Scan public government websites for compliance with ICTA.6.002:2019
            Section 6.4
          </p>
          <p className="mb-8 text-sm text-icta-gray-600">
            Government website compliance checker — internal ICTA tool
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/scan"
              className="rounded-md bg-icta-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-icta-red/90"
            >
              Scan a site
            </Link>
            <Link
              href="/health"
              className="rounded-md border border-icta-gray-200 px-6 py-3 text-sm font-semibold text-icta-black transition-colors hover:bg-icta-gray-50"
            >
              System health
            </Link>
            <span className="text-sm text-icta-gray-600">
              Full landing page — Phase 7
            </span>
          </div>
        </div>
      </main>

      <footer className="border-t border-icta-gray-200 py-4 text-center text-xs text-icta-gray-600">
        ICTA Sentinel · Internal compliance tool
      </footer>
    </div>
  );
}
