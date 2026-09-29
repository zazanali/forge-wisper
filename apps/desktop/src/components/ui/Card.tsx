import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "accent";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", padding = "md", children, ...props }, ref) => {
    const variantStyles = {
      default:
        "bg-[var(--surface-primary)] border border-[var(--border)] shadow-[var(--shadow-subtle)]",
      elevated:
        "bg-[var(--surface-elevated)] border border-[var(--border)] shadow-md",
      interactive:
        "bg-[var(--surface-primary)] border border-[var(--border)] hover:border-[var(--accent-border)] hover:bg-[var(--surface-hover)] transition-all duration-150 cursor-pointer shadow-[var(--shadow-subtle)] hover:shadow-md",
      accent:
        "bg-[var(--surface-primary)] border border-[var(--accent-border)] shadow-[0_0_15px_var(--accent-subtle)]",
    };

    const paddingStyles = {
      none: "p-0",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-6",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-card)] transition-colors",
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-between gap-3 mb-3", className)}
    {...props}
  />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-[14px] font-semibold tracking-tight text-[var(--text-primary)]",
      className
    )}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[12px] text-[var(--text-secondary)] leading-relaxed", className)}
    {...props}
  />
));

CardDescription.displayName = "CardDescription";
