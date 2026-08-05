"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, Mail, ShieldCheck, User } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { AuthError, getCurrentUser, registerUser } from "@/lib/auth";
import { btnPrimary, fieldLabel, inputBase, inputError, textLink } from "@/lib/ui";

const iconWrap = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icta-gray-400";
const inputWithIcon = "pl-9";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.replace(user.onboarded ? "/" : "/onboarding");
    }
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await registerUser({ name, email, password });
      router.replace(user.onboarded ? "/" : "/onboarding");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Unable to register.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for scanning, reviewing, and monitoring government sites."
      markLabel="Sentinel register"
      eyebrowLabel="Sentinel"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className={`font-medium ${textLink}`}
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="reg-name" className={fieldLabel}>
            Full name
          </label>
          <div className="relative">
            <User className={`${iconWrap} size-4`} aria-hidden="true" />
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className={`${inputBase} ${inputWithIcon}`}
              placeholder="e.g. Amina Hassan"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className={fieldLabel}>
            Email
          </label>
          <div className="relative">
            <Mail className={`${iconWrap} size-4`} aria-hidden="true" />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className={`${inputBase} ${inputWithIcon}`}
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className={fieldLabel}>
            Password
          </label>
          <div className="relative">
            <Lock className={`${iconWrap} size-4`} aria-hidden="true" />
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className={`${inputBase} ${inputWithIcon}`}
              placeholder="At least 8 characters"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-confirm" className={fieldLabel}>
            Confirm password
          </label>
          <div className="relative">
            <ShieldCheck className={`${iconWrap} size-4`} aria-hidden="true" />
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error) setError(null);
              }}
              className={`${inputBase} ${inputWithIcon} ${error ? inputError : ""}`}
              placeholder="Repeat your password"
            />
          </div>
        </div>

        {error && <ErrorState compact message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className={`${btnPrimary} w-full`}
        >
          {submitting ? (
            <>
              <Spinner size="sm" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>

        <p className="text-center text-xs leading-relaxed text-icta-gray-600">
          By creating an account you agree to our{" "}
          <Link href="/terms" className={textLink}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className={textLink}>
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
