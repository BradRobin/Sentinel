import Link from "next/link";

import { StandardDocLink } from "@/components/ClauseLink";
import { SentinelMark } from "@/components/SentinelMark";
import { btnPrimaryLg, btnSecondaryLg } from "@/lib/ui";

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
            Scan public government websites for compliance with{" "}
            <StandardDocLink>ICTA.6.003:2023 §6.5</StandardDocLink>
          </p>
          <p className="mb-8 text-sm text-icta-gray-600">
            Government website compliance checker — internal ICTA tool
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/scan" className={btnPrimaryLg}>
              Scan a site
            </Link>
            <Link href="/standards" className={btnSecondaryLg}>
              Standards
            </Link>
            <Link href="/registry" className={btnSecondaryLg}>
              MCDA registry
            </Link>
            <Link href="/map" className={btnSecondaryLg}>
              Kenya map
            </Link>
            <Link href="/health" className={btnSecondaryLg}>
              System health
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-icta-gray-200 py-4 text-center text-xs text-icta-gray-600">
        ICTA Sentinel · Internal compliance tool
      </footer>
    </div>
  );
}
