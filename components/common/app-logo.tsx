import Image from "next/image";
import { cn } from "@/lib/utils";

type AppLogoVariant = "full" | "icon";
type AppLogoSize = "sm" | "md" | "lg";

interface AppLogoProps {
  alt?: string;
  className?: string;
  priority?: boolean;
  size?: AppLogoSize;
  variant?: AppLogoVariant;
}

const sizeClasses: Record<AppLogoVariant, Record<AppLogoSize, string>> = {
  full: {
    sm: "h-7 w-auto",
    md: "h-8 w-auto",
    lg: "h-10 w-auto",
  },
  icon: {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  },
};

const dimensions: Record<AppLogoVariant, { width: number; height: number; lightSrc: string; darkSrc: string }> = {
  full: {
    width: 980,
    height: 240,
    lightSrc: "/logo-main-light.svg",
    darkSrc: "/logo-main-dark.svg",
  },
  icon: {
    width: 128,
    height: 128,
    lightSrc: "/icon-logo-light.svg",
    darkSrc: "/icon-logo-dark.svg",
  },
};

export function AppLogo({
  alt = "Zetsu",
  className,
  priority = false,
  size = "md",
  variant = "full",
}: AppLogoProps) {
  const asset = dimensions[variant];
  const sizingClass = sizeClasses[variant][size];

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={asset.lightSrc}
        alt={alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={cn("block dark:hidden", sizingClass)}
      />
      <Image
        src={asset.darkSrc}
        alt={alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={cn("hidden dark:block", sizingClass)}
      />
    </span>
  );
}
