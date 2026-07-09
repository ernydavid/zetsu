"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onCheckedChange(!checked);
        }
      }}
      className={cn(
        "relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        checked
          ? "border-accent-soft-fg/70 bg-accent-soft-fg shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
          : "border-border/90 bg-slate-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] dark:border-slate-500 dark:bg-slate-700",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-4 rounded-full border border-black/5 bg-white shadow-sm transition-transform duration-200 ease-out dark:border-white/10 dark:bg-slate-100",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
