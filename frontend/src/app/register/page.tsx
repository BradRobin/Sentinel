"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { AuthShell } from "@/components/AuthShell";
import { ErrorState } from "@/components/ErrorState";
import { AuthError, getCurrentUser, registerUser } from "@/lib/auth";
import { btnPrimary, inputBase, inputError } from "@/lib/ui";

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
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-icta-link underline decoration-from-font underline-offset-2 hover:opacity-80"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="reg-name"
            className="mb-1.5 block text-sm font-medium text-icta-black"
          >
            Full name
          </label>
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
            className={inputBase}
            placeholder="e.g. Amina Hassan"
          />
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="mb-1.5 block text-sm font-medium text-icta-black"
          >
            Email
          </label>
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
            className={inputBase}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="reg-password"
            className="mb-1.5 block text-sm font-medium text-icta-black"
          >
            Password
          </label>
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
            className={inputBase}
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label
            htmlFor="reg-confirm"
            className="mb-1.5 block text-sm font-medium text-icta-black"
          >
            Confirm password
          </label>
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
            className={`${inputBase} ${error ? inputError : ""}`}
            placeholder="Repeat your password"
          />
        </div>

        {error && <ErrorState compact message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className={`${btnPrimary} w-full`}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-xs leading-relaxed text-icta-gray-600">
          By creating an account you agree to our{" "}
          <Link
            href="/terms"
            className="text-icta-link underline decoration-from-font underline-offset-2 hover:opacity-80"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-icta-link underline decoration-from-font underline-offset-2 hover:opacity-80"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
