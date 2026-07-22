import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* ICTA stripe motif — placeholder branding only */}
      <div className="flex h-2 w-full">
        <div className="flex-1 bg-icta-black" />
        <div className="flex-1 bg-icta-red" />
        <div className="flex-1 bg-icta-green" />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-24">
        <div className="max-w-2xl text-center">
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
            [Placeholder branding — official ICTA assets pending]
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/health"
              className="rounded-md bg-icta-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-icta-red/90"
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
