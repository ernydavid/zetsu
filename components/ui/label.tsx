import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground select-none block mb-1.5",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
