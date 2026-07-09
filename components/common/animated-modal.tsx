"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AnimatedModalProps {
  open: boolean;
  children: React.ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  durationMs?: number;
}

export function AnimatedModal({
  open,
  children,
  overlayClassName,
  panelClassName,
  durationMs = 180,
}: AnimatedModalProps) {
  const [isMounted, setIsMounted] = React.useState(open);

  React.useEffect(() => {
    if (open) {
      setIsMounted(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMounted(false);
    }, durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [open, durationMs]);

  if (!isMounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity ease-out",
        open ? "opacity-100" : "opacity-0",
        overlayClassName,
      )}
      style={{ transitionDuration: `${durationMs}ms` }}
    >
      <div
        className={cn(
          "transition-all ease-out",
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.97] opacity-0",
          panelClassName,
        )}
        style={{ transitionDuration: `${durationMs}ms` }}
      >
        {children}
      </div>
    </div>
  );
}
