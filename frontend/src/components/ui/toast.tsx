import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider
const Toast = ToastPrimitives.Root

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-50 flex max-h-screen items-end gap-2 p-4 outline-none",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const ToastItem = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(
      "group pointer-events-auto relative flex w-full max-w-[350px] items-center gap-2 rounded-lg border border-icta-gray-200 bg-white p-4 shadow-lg text-sm text-icta-gray-900 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full duration-300",
      className
    )}
    {...props}
  />
))
ToastItem.displayName = ToastPrimitives.Root.displayName

export {
  ToastProvider,
  Toast,
  ToastItem,
  ToastViewport,
}
