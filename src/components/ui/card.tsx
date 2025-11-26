import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Premium Card Component
 *
 * Features multiple visual variants:
 * - Default: Subtle elevation with border
 * - Glass: Glassmorphism with backdrop blur
 * - Depth: Multi-layered shadow for 3D effect
 * - Glow: Animated glow on hover
 * - Gradient: Gradient border effect
 */

const cardVariants = cva(
  "rounded-xl text-card-foreground transition-all duration-300",
  {
    variants: {
      variant: {
        default: [
          "bg-card border border-border/50",
          "shadow-sm hover:shadow-md",
        ].join(" "),

        glass: [
          "backdrop-blur-md bg-white/10 dark:bg-white/5",
          "border border-white/20 dark:border-white/10",
          "shadow-lg shadow-black/5 dark:shadow-black/20",
        ].join(" "),

        depth: [
          "bg-card border border-border/30",
          "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_8px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.03),0_16px_32px_rgba(0,0,0,0.02)]",
          "dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.15),0_8px_16px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]",
          "hover:shadow-[0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06),0_16px_32px_rgba(0,0,0,0.04),0_24px_48px_rgba(0,0,0,0.02)]",
          "hover:-translate-y-0.5",
        ].join(" "),

        glow: [
          "relative bg-card border border-border/30",
          "before:absolute before:-inset-[1px] before:rounded-xl before:opacity-0 before:transition-opacity before:duration-500 before:-z-10",
          "before:bg-gradient-to-r before:from-primary before:via-accent before:to-primary",
          "before:blur-lg",
          "hover:before:opacity-70",
          "shadow-lg",
        ].join(" "),

        gradient: [
          "relative bg-card overflow-hidden",
          "before:absolute before:-inset-[1px] before:rounded-[inherit] before:-z-10",
          "before:bg-gradient-to-r before:from-primary before:via-accent before:to-primary",
          "before:bg-[length:200%_100%] before:animate-[gradient-x_4s_ease_infinite]",
          "after:absolute after:inset-[1px] after:rounded-[10px] after:bg-card after:-z-10",
        ].join(" "),

        elevated: [
          "bg-card border border-border/20",
          "shadow-xl shadow-black/5 dark:shadow-black/30",
          "hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/40",
          "hover:-translate-y-1",
        ].join(" "),

        interactive: [
          "bg-card border border-border/50 cursor-pointer",
          "shadow-sm hover:shadow-lg",
          "hover:border-primary/30 hover:-translate-y-0.5",
          "active:scale-[0.99]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight",
      className
    )}
    style={{ fontFamily: 'var(--font-display)' }}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Additional premium card components

const GlassCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative rounded-2xl overflow-hidden",
      "backdrop-blur-xl bg-white/10 dark:bg-black/20",
      "border border-white/20 dark:border-white/10",
      "shadow-xl shadow-black/5 dark:shadow-black/30",
      className
    )}
    {...props}
  >
    {/* Gradient shine effect */}
    <div
      className="absolute inset-0 pointer-events-none opacity-50"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)'
      }}
    />
    <div className="relative z-10">{children}</div>
  </div>
))
GlassCard.displayName = "GlassCard"

const FeatureCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    icon?: React.ReactNode
    title: string
    description: string
  }
>(({ className, icon, title, description, ...props }, ref) => (
  <Card
    ref={ref}
    variant="interactive"
    className={cn("p-6 group", className)}
    {...props}
  >
    {icon && (
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
        {icon}
      </div>
    )}
    <CardTitle className="text-lg mb-2">{title}</CardTitle>
    <CardDescription>{description}</CardDescription>
  </Card>
))
FeatureCard.displayName = "FeatureCard"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  GlassCard,
  FeatureCard,
  cardVariants,
}
