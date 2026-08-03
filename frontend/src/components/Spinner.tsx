import { Loader2 } from "lucide-react";

const SIZES = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
}

/** Inline loading spinner — pairs with btn tokens for loading states. */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <Loader2
      className={`animate-spin ${SIZES[size]} ${className}`}
      aria-hidden="true"
    />
  );
}
