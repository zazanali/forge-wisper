import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "success" | "warning" | "error" | "neutral" | "outline";
  size?: "sm" | "md";
  hasDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  size = "sm",
  hasDot = false,
  children,
  ...props
}) => {
  const variantStyles = {
    default:
      "bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)]",
    accent:
      "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-medium",
    success:
      "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)] font-medium",
    warning:
      "bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)] font-medium",
    error:
      "bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error-border)] font-medium",
    neutral:
      "bg-[var(--surface-primary)] text-[var(--text-muted)] border border-[var(--border-subtle)]",
    outline:
      "bg-transparent text-[var(--text-secondary)] border border-[var(--border)]",
  };

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 rounded-[var(--radius-control)] gap-1.5",
    md: "text-[12px] px-2.5 py-1 rounded-[var(--radius-control)] gap-2",
  };

  const dotColors = {
    default: "bg-[var(--text-secondary)]",
    accent: "bg-[var(--accent)]",
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    error: "bg-[var(--error)]",
    neutral: "bg-[var(--text-muted)]",
    outline: "bg-[var(--text-secondary)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono leading-none tracking-tight select-none transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {hasDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
