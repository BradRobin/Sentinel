import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-icta-green text-white shadow-card hover:bg-icta-green-deep hover:shadow-card-hover active:bg-icta-green-deep focus-visible:outline-icta-green",
        destructive:
          "bg-icta-red text-white shadow-card hover:bg-icta-red-deep active:bg-icta-red-deep focus-visible:outline-icta-red",
        outline:
          "border border-icta-gray-200 bg-white text-icta-gray-800 shadow-card hover:border-icta-gray-300 hover:bg-icta-gray-50 hover:text-icta-gray-900 focus-visible:outline-icta-gray-800",
        secondary:
          "bg-icta-gray-100 text-icta-gray-900 hover:bg-icta-gray-200 focus-visible:outline-icta-gray-800",
        ghost:
          "hover:bg-icta-gray-100 text-icta-gray-600 hover:text-icta-gray-900 focus-visible:outline-icta-gray-800",
        muted:
          "bg-icta-gray-50 text-icta-gray-600 border border-icta-gray-200 hover:bg-icta-gray-100 hover:text-icta-gray-900 focus-visible:outline-icta-gray-800",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
