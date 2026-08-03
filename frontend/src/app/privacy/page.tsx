function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-icta-black">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-icta-gray-600">
        {children}
      </div>
    </section>
  );
}

export const metadata = {
  title: "Privacy Policy · ICTA Sentinel",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-icta-gray-600">
          ICTA Sentinel
        </p>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-icta-black">
          Privacy Policy
        </h1>
        <p className="mb-10 text-sm text-icta-gray-600">
          Last updated: August 2026
        </p>

        <div className="space-y-8">
          <Section title="Overview">
            <p>
              ICTA Sentinel is an internal compliance tool operated by the ICT
              Authority (ICTA) of Kenya. It helps officers check public
              government websites against the ICTA.6.003:2023 §6.5 standard.
              This policy explains what information the tool collects and how
              it is used.
            </p>
          </Section>

          <Section title="Information we process">
            <p>
              Account information you provide when registering — your name,
              email address, role, and organisation.
            </p>
            <p>
              Compliance data generated from scanning public{" "}
              <code className="text-xs">.go.ke</code> /{" "}
              <code className="text-xs">.gov.ke</code> websites, including
              scan results, findings, scores, and historical snapshots.
            </p>
            <p>
              Audit records of manual review decisions, including officer
              identity and justification text.
            </p>
          </Section>

          <Section title="How we use information">
            <p>
              To operate Sentinel — running scans, producing compliance scores
              and reports, maintaining the MCDA registry, and supporting
              officer review workflows.
            </p>
            <p>
              To generate narrative summaries and semantic judgments, a third
              party AI service (Google Gemini) may receive excerpts of scanned
              public content. No passwords or account details are sent.
            </p>
          </Section>

          <Section title="Data we do not collect">
            <p>
              Sentinel only scans publicly accessible government websites. It
              does not collect personal data from those sites, does not track
              individual citizens, and does not place advertising cookies.
            </p>
          </Section>

          <Section title="Storage and security">
            <p>
              Scan and registry data is stored in a PostgreSQL database managed
              by ICTA or its authorized infrastructure providers. Access to
              Sentinel is restricted to authorized ICTA officers and
              administrators. This prototype uses demo-grade local
              authentication; production authentication will follow ICTA
              security standards.
            </p>
          </Section>

          <Section title="Retention">
            <p>
              Historical compliance snapshots are kept to support trend and
              comparison views. Account records persist until requested for
              removal. Contact ICTA to request access to or deletion of your
              account data.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For questions about this policy, contact the ICT Authority of
              Kenya via the official channels listed at{" "}
              <a
                href="https://icta.go.ke"
                target="_blank"
                rel="noopener noreferrer"
                className="text-icta-link underline decoration-from-font underline-offset-2 hover:opacity-80"
              >
                icta.go.ke
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
