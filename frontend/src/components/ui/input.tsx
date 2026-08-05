import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-icta-gray-200 bg-white px-3 py-1 text-sm text-icta-gray-900 shadow-card transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-icta-gray-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-icta-green/10 focus-visible:border-icta-green/60 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
