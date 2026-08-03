"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import {
  getCurrentUser,
  updateUser,
  type SentinelRole,
} from "@/lib/auth";
import {
  btnGhost,
  btnPrimary,
  inputBase,
  linkQuiet,
} from "@/lib/ui";

const TOTAL_STEPS = 3;

const ROLE_OPTIONS: Array<{
  value: SentinelRole;
  title: string;
  description: string;
}> = [
  {
    value: "officer",
    title: "Compliance officer",
    description: "Resolve the manual review queue and sign off findings.",
  },
  {
    value: "admin",
    title: "Administrator",
    description: "Run scans, manage the registry, and monitor compliance.",
  },
];

function stepLabel(step: number): string {
  switch (step) {
    case 0:
      return "Your role";
    case 1:
      return "Your organisation";
    default:
      return "Review";
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<SentinelRole | null>(null);
  const [organization, setOrganization] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.onboarded) {
      router.replace("/");
    }
  }, [router]);

  function next() {
    if (step === 0 && !role) {
      setError("Choose a role to continue.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function complete() {
    setSaving(true);
    setError(null);
    try {
      await updateUser({
        role,
        organization: organization.trim() || null,
        onboarded: true,
      });
      router.replace("/");
    } catch {
      setError("Something went wrong saving your profile. Please try again.");
      setSaving(false);
    }
  }

  return (
    <AuthShell
      title="Let's get you set up"
      subtitle="A couple of quick questions so Sentinel fits the way you work."
      markLabel="Sentinel onboarding"
      footer={
        <button
          type="button"
          onClick={() => void complete()}
          className={linkQuiet}
        >
          Skip for now
        </button>
      }
    >
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2 text-xs text-icta-gray-600">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={
                i === step
                  ? "font-semibold text-icta-black"
                  : i < step
                    ? "text-icta-green"
                    : ""
              }
            >
              {i + 1}. {stepLabel(i)}
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i <= step ? "bg-icta-green" : "bg-icta-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div key={step} className="animate-fade-in-up">
        {step === 0 && (
          <div className="space-y-3" role="radiogroup" aria-label="Your role">
            <p className="text-sm font-medium text-icta-black">
              How will you use Sentinel?
            </p>
            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setRole(option.value);
                    setError(null);
                  }}
                  className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-icta-green bg-icta-green/5 ring-1 ring-icta-green"
                      : "border-icta-gray-200 bg-white hover:bg-icta-gray-50"
                  }`}
                >
                  <span className="block font-medium text-icta-black">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-icta-gray-600">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div>
            <label
              htmlFor="onboard-org"
              className="mb-1.5 block text-sm font-medium text-icta-black"
            >
              Organisation name
            </label>
            <input
              id="onboard-org"
              type="text"
              value={organization}
              onChange={(e) => {
                setOrganization(e.target.value);
                setError(null);
              }}
              className={inputBase}
              placeholder="e.g. ICT Authority"
            />
            <p className="mt-1.5 text-xs text-icta-gray-600">
              Optional — used to personalise your account.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-md border border-icta-gray-200 bg-icta-gray-50 p-4 text-sm">
            <dl className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-icta-gray-600">Name</dt>
                <dd className="font-medium text-icta-black">
                  {getCurrentUser()?.name ?? "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-icta-gray-600">Role</dt>
                <dd className="font-medium text-icta-black">
                  {ROLE_OPTIONS.find((r) => r.value === role)?.title ?? "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-icta-gray-600">Organisation</dt>
                <dd className="font-medium text-icta-black">
                  {organization.trim() || "Not set"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {error && <ErrorState compact message={error} className="mt-4" />}

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" onClick={back} className={btnGhost}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </button>
        ) : (
          <span />
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button type="button" onClick={next} className={btnPrimary}>
            Continue
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void complete()}
            disabled={saving}
            className={btnPrimary}
          >
            {saving ? (
              <>
                <Spinner size="sm" />
                Finishing…
              </>
            ) : (
              "Start using Sentinel"
            )}
          </button>
        )}
      </div>
    </AuthShell>
  );
}
