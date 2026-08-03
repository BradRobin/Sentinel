"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { AuthShell } from "@/components/AuthShell";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { AuthError, getCurrentUser, loginUser } from "@/lib/auth";
import { btnPrimary, inputBase, inputError, textLink } from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setSubmitting(true);
    try {
      const user = await loginUser({ email, password });
      router.replace(user.onboarded ? "/" : "/onboarding");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Unable to log in.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to scan sites, review findings, and track compliance."
      markLabel="Sentinel login"
      footer={
        <>
          No account yet?{" "}
          <Link
            href="/register"
            className={`font-medium ${textLink}`}
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-sm font-medium text-icta-black"
          >
            Email
          </label>
          <input
            id="login-email"
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
            htmlFor="login-password"
            className="mb-1.5 block text-sm font-medium text-icta-black"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            className={`${inputBase} ${error ? inputError : ""}`}
            placeholder="••••••••"
          />
        </div>

        {error && <ErrorState compact message={error} />}

        <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
          {submitting ? (
            <>
              <Spinner size="sm" />
              Logging in…
            </>
          ) : (
            "Log in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
