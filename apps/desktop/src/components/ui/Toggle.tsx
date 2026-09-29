import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  id?: string;
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  size = "md",
  className,
  id,
  label,
}) => {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const trackSizes = {
    sm: "w-8 h-4.5 p-0.5",
    md: "w-10 h-5.5 p-0.5",
  };

  const thumbSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4.5 h-4.5",
  };

  const thumbTranslations = {
    sm: checked ? "translate-x-3.5" : "translate-x-0",
    md: checked ? "translate-x-4.5" : "translate-x-0",
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] select-none shrink-0",
        trackSizes[size],
        checked
          ? "bg-[var(--accent)] border border-[var(--accent-hover)] shadow-[0_0_8px_var(--accent-subtle)]"
          : "bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[var(--border-subtle)]",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out transform",
          thumbSizes[size],
          thumbTranslations[size],
          checked ? "bg-[var(--accent-contrast)]" : "bg-[var(--text-secondary)]"
        )}
      />
    </button>
  );
};
