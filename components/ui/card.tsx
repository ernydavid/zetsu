import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  brutalist?: boolean; // Mantener propiedad por compatibilidad
  hoverable?: boolean;
  soft?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, brutalist = false, hoverable = false, soft = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "p-6 md:p-8 rounded-2xl border transition-all duration-200",
          soft
            ? "bg-accent-soft-bg border-accent-soft-border text-foreground"
            : "bg-card text-card-foreground border-premium",
          hoverable && "hover:-translate-y-1 hover:shadow-premium-lg cursor-pointer active:translate-y-0",
          !hoverable && "shadow-premium",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-heading-style text-xl font-bold tracking-tight leading-none mb-2", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground font-mono leading-relaxed", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("pt-4", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center pt-4 border-t border-dashed border-border mt-4", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardTitle, CardDescription, CardContent, CardFooter };
