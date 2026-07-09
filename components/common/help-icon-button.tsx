"use client";

import * as React from "react";
import { IconHelp } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface HelpIconButtonProps {
  onClick?: () => void;
  className?: string;
}

export function HelpIconButton({ onClick, className }: HelpIconButtonProps) {
  return (
    <div className="group relative">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onClick}
        aria-label="Ayuda"
        title="Ayuda"
        className={className}
      >
        <IconHelp className="size-4" />
      </Button>
      <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-20 rounded-lg border border-premium bg-card px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground opacity-0 shadow-premium transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        ayuda
      </div>
    </div>
  );
}
