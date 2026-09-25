"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

import { inputBase } from "@/lib/ui";

type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  label: string;
  id?: string;
  className?: string;
  inputClassName?: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.5 11.5 0 0 1-1.7 3.1" />
        <path d="M6.1 6.1A11.4 11.4 0 0 0 1 12.5C2.7 16.9 7 20 12 20a9.8 9.8 0 0 0 4.2-.9" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5c-1.7 4.4-6 7.5-11 7.5S2.7 16.9 1 12.5Z" />
      <circle cx="12" cy="12.5" r="3" />
    </svg>
  );
}

export function PasswordField({
  label,
  id,
  className,
  inputClassName,
  ...inputProps
}: PasswordFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-sm font-medium text-icta-black"
      >
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          id={fieldId}
          type={visible ? "text" : "password"}
          className={`${inputBase} pr-11 ${inputClassName ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-icta-gray-600 transition-colors hover:text-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-icta-black"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </div>
  );
}
