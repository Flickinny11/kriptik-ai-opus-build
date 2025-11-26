import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Premium Button Component
 *
 * Features:
 * - Glow effects on primary variants
 * - Smooth transitions with custom easing
 * - Glassmorphism variants
 * - Active state feedback
 */

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0"
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/20",
          "hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5",
          "border border-primary/20"
        ].join(" "),

        gradient: [
          "bg-gradient-to-r from-primary via-accent to-primary",
          "bg-[length:200%_100%]",
          "text-primary-foreground",
          "shadow-lg shadow-primary/25",
          "hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5",
          "hover:bg-[100%_0%]",
          "transition-all duration-500"
        ].join(" "),

        glow: [
          "relative bg-primary text-primary-foreground",
          "shadow-[0_0_20px_var(--glow-primary)]",
          "hover:shadow-[0_0_30px_var(--glow-primary)] hover:-translate-y-0.5",
          "before:absolute before:inset-0 before:rounded-[inherit]",
          "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:opacity-0 hover:before:opacity-100",
          "before:transition-opacity before:duration-300"
        ].join(" "),

        glass: [
          "bg-white/10 dark:bg-white/5",
          "backdrop-blur-md border border-white/20",
          "text-foreground",
          "hover:bg-white/20 dark:hover:bg-white/10",
          "shadow-lg shadow-black/5"
        ].join(" "),

        destructive: [
          "bg-destructive text-white",
          "shadow-lg shadow-destructive/25",
          "hover:shadow-xl hover:shadow-destructive/35 hover:-translate-y-0.5"
        ].join(" "),

        outline: [
          "border-2 border-border bg-transparent",
          "hover:bg-accent/50 hover:border-primary/50",
          "text-foreground"
        ].join(" "),

        secondary: [
          "bg-secondary text-secondary-foreground",
          "shadow-sm",
          "hover:bg-secondary/80 hover:shadow-md"
        ].join(" "),

        ghost: [
          "hover:bg-accent hover:text-accent-foreground",
          "text-muted-foreground"
        ].join(" "),

        link: [
          "text-primary underline-offset-4",
          "hover:underline hover:text-primary/80"
        ].join(" "),

        premium: [
          "relative overflow-hidden",
          "bg-gradient-to-br from-primary via-primary to-accent",
          "text-primary-foreground font-semibold",
          "shadow-xl shadow-primary/30",
          "hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1",
          "before:absolute before:inset-0",
          "before:bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)]",
          "before:bg-[length:250%_250%]",
          "before:animate-shimmer",
          "transition-all duration-300"
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2 text-sm rounded-xl [&_svg]:size-4",
        sm: "h-8 px-4 py-1.5 text-xs rounded-lg [&_svg]:size-3.5",
        lg: "h-12 px-8 py-3 text-base rounded-xl [&_svg]:size-5",
        xl: "h-14 px-10 py-4 text-lg rounded-2xl [&_svg]:size-6",
        icon: "h-10 w-10 rounded-xl [&_svg]:size-5",
        "icon-sm": "h-8 w-8 rounded-lg [&_svg]:size-4",
        "icon-lg": "h-12 w-12 rounded-xl [&_svg]:size-6",
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
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
