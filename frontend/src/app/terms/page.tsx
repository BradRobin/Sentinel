import Link from "next/link";

import { linkQuiet } from "@/lib/ui";

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
  title: "Terms of Service · ICTA Sentinel",
};

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <Link href="/" className={`mb-8 inline-block ${linkQuiet}`}>
          ← Back to home
        </Link>

        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-icta-gray-600">
          ICTA Sentinel
        </p>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-icta-black">
          Terms of Service
        </h1>
        <p className="mb-10 text-sm text-icta-gray-600">
          Last updated: August 2026
        </p>

        <div className="space-y-8">
          <Section title="Acceptance of terms">
            <p>
              By creating an account and using ICTA Sentinel, you agree to
              these terms. Sentinel is an internal tool operated by the ICT
              Authority (ICTA) of Kenya for authorised officers and
              administrators.
            </p>
          </Section>

          <Section title="Eligibility and accounts">
            <p>
              Accounts are intended for ICTA staff and approved collaborators.
              You are responsible for safeguarding your login credentials and
              for activity carried out under your account.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              Sentinel scans publicly accessible{" "}
              <code className="text-xs">.go.ke</code> and{" "}
              <code className="text-xs">.gov.ke</code> websites. You must not
              use the tool to scan restricted, private, or non-governmental
              sites, or to circumvent website security measures. Scans are
              rate-limited and conducted responsibly.
            </p>
            <p>
              Manual review resolutions must be based on genuine inspection or
              attestation, and justifications must reflect the evidence
              reviewed. Knowingly submitting false resolutions is prohibited.
            </p>
          </Section>

          <Section title="Compliance outputs">
            <p>
              Scores and findings reflect automated checks and officer review
              at a point in time. They are advisory and do not constitute a
              formal certification of any website. Reports should be reviewed
              by an authorised officer before use in official correspondence.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              The ICTA.6.003:2023 standard, Sentinel software, and its
              documentation belong to their respective owners. Data compiled
              through Sentinel is used for ICTA&apos;s public-sector compliance
              mandate.
            </p>
          </Section>

          <Section title="Availability">
            <p>
              Sentinel is provided on an &ldquo;as is&rdquo; basis. ICTA does
              not guarantee uninterrupted availability and may suspend or
              change the service as part of maintenance or policy updates.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the extent permitted by law, ICTA is not liable for indirect
              or consequential losses arising from use of Sentinel, including
              decisions made in reliance on scan results.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              ICTA may update these terms from time to time. Continued use of
              Sentinel after changes take effect constitutes acceptance of the
              updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms may be directed to the ICT Authority
              of Kenya via the official channels listed at{" "}
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
