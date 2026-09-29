import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronDown, Check } from "lucide-react";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

export interface DropdownProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  id?: string;
}

export function Dropdown<T = string>({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
  size = "md",
  id,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "ArrowDown" && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex((opt) => opt.value === value);
      const nextIndex = Math.min(currentIndex + 1, options.length - 1);
      if (!options[nextIndex].disabled) {
        onChange(options[nextIndex].value);
      }
    } else if (e.key === "ArrowUp" && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex((opt) => opt.value === value);
      const prevIndex = Math.max(currentIndex - 1, 0);
      if (!options[prevIndex].disabled) {
        onChange(options[prevIndex].value);
      }
    }
  };

  const sizeStyles = {
    sm: "h-8 text-[12px] px-2.5",
    md: "h-9 text-[13px] px-3",
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block w-full", className)}
      onKeyDown={handleKeyDown}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--surface-primary)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] transition-all cursor-pointer select-none",
          sizeStyles[size],
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "border-[var(--accent)] ring-1 ring-[var(--accent-border)]"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-[var(--accent)]"
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-[var(--radius-card)] bg-[var(--surface-primary)] border border-[var(--border)] shadow-xl p-1 text-[13px] animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={String(option.value)}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  if (!option.disabled) {
                    onChange(option.value);
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-[var(--radius-control)] cursor-pointer transition-colors select-none",
                  isSelected
                    ? "bg-[var(--surface-elevated)] text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
                  option.disabled && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon}
                  <div className="flex flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-[11px] text-[var(--text-muted)] leading-tight">
                        {option.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {option.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--text-muted)] font-mono">
                      {option.badge}
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
