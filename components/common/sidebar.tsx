"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { signout } from "@/app/auth/actions";
import {
  IconHome,
  IconReceipt,
  IconCreditCard,
  IconChartBar,
  IconLock,
  IconSettings,
  IconLogout,
  IconChevronUp,
  IconUser,
  IconShieldLock,
  IconPalette,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";

interface SidebarProps {
  activeTab: "dashboard" | "transactions" | "subscriptions" | "settings";
  profile: any;
  currency: string;
}

export function Sidebar({ activeTab, profile, currency }: SidebarProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <aside className="w-64 border-r border-premium bg-card flex flex-col justify-between hidden lg:flex shrink-0">
      <div className="p-8 space-y-8">
        <div className="flex items-center space-x-3">
          <span className="font-heading-style text-2xl font-black tracking-tighter">
            zetsu<span className="text-accent-soft-fg font-serif">.</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 border border-accent-soft-border rounded-full bg-accent-soft-bg text-accent-soft-fg uppercase font-bold tracking-wider">
            {profile.billing_tier}
          </span>
        </div>

        <nav className="space-y-2">
          <Link
            href="/dashboard"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
              activeTab === "dashboard"
                ? "bg-accent-soft-bg text-accent-soft-fg border-accent-soft-border font-medium"
                : "border-transparent text-muted-foreground hover:bg-muted/10"
            }`}
          >
            <IconHome className="size-4" />
            <span className="font-mono uppercase tracking-wider text-xs">
              dashboard
            </span>
          </Link>

          <Link
            href="/dashboard/transactions"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
              activeTab === "transactions"
                ? "bg-accent-soft-bg text-accent-soft-fg border-accent-soft-border font-medium"
                : "border-transparent text-muted-foreground hover:bg-muted/10"
            }`}
          >
            <IconReceipt className="size-4" />
            <span className="font-mono uppercase tracking-wider text-xs">
              transacciones
            </span>
          </Link>

          <Link
            href="/dashboard/subscriptions"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
              activeTab === "subscriptions"
                ? "bg-accent-soft-bg text-accent-soft-fg border-accent-soft-border font-medium"
                : "border-transparent text-muted-foreground hover:bg-muted/10"
            }`}
          >
            <IconCreditCard className="size-4" />
            <span className="font-mono uppercase tracking-wider text-xs">
              suscripciones
            </span>
          </Link>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground cursor-not-allowed hover:bg-muted/10 transition-all duration-200 opacity-60">
            <span className="flex items-center space-x-3">
              <IconChartBar className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">
                proyecciones
              </span>
            </span>
            <IconLock className="size-3 text-muted-foreground/60" />
          </div>

          <Link
            href="/dashboard/settings"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
              activeTab === "settings"
                ? "bg-accent-soft-bg text-accent-soft-fg border-accent-soft-border font-medium"
                : "border-transparent text-muted-foreground hover:bg-muted/10"
            }`}
          >
            <IconSettings className="size-4" />
            <span className="font-mono uppercase tracking-wider text-xs">
              ajustes
            </span>
          </Link>
        </nav>
      </div>

      {/* User Card with Popover */}
      <div className="p-6 border-t border-premium relative" ref={menuRef}>
        {/* Popover Menu */}
        {isMenuOpen && (
          <div className="absolute bottom-[calc(100%-12px)] left-6 right-6 p-3 bg-card border border-premium rounded-2xl shadow-premium-lg z-50 space-y-2 animate-scale-up">
            <div className="px-2 py-1.5 border-b pb-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider px-2 py-1 rounded-full border">
                cuenta ({profile.billing_tier})
              </p>
            </div>

            <div className="space-y-1">
              <Link
                href="/dashboard/settings?tab=profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2.5 px-2 py-2 rounded-xl text-xs font-mono text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors cursor-pointer w-full text-left"
              >
                <IconUser className="size-4 text-muted-foreground" />
                <span className="uppercase tracking-wider text-[10px]">
                  perfil
                </span>
              </Link>
              <Link
                href="/dashboard/settings?tab=theme"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2.5 px-2 py-2 rounded-xl text-xs font-mono text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors cursor-pointer w-full text-left"
              >
                <IconPalette className="size-4 text-muted-foreground" />
                <span className="uppercase tracking-wider text-[10px]">
                  tema
                </span>
              </Link>
              <Link
                href="/dashboard/settings?tab=security"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-2.5 px-2 py-2 rounded-xl text-xs font-mono text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors cursor-pointer w-full text-left"
              >
                <IconShieldLock className="size-4 text-muted-foreground" />
                <span className="uppercase tracking-wider text-[10px]">
                  seguridad
                </span>
              </Link>

              {/* Dynamic Theme Toggle Option */}
              {mounted ? (
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center space-x-2.5 px-2 py-2 rounded-xl text-xs font-mono text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors cursor-pointer w-full text-left focus:outline-none"
                >
                  {theme === "dark" ? (
                    <>
                      <IconSun className="size-4 text-muted-foreground" />
                      <span className="uppercase tracking-wider text-[10px]">
                        modo claro
                      </span>
                    </>
                  ) : (
                    <>
                      <IconMoon className="size-4 text-muted-foreground" />
                      <span className="uppercase tracking-wider text-[10px]">
                        modo oscuro
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center space-x-2.5 px-2 py-2 rounded-xl text-xs font-mono text-muted-foreground opacity-50 w-full text-left">
                  <IconMoon className="size-4 text-muted-foreground" />
                  <span className="uppercase tracking-wider text-[10px]">
                    modo oscuro
                  </span>
                </div>
              )}
            </div>

            <div className=" pt-2">
              <form action={signout} onSubmit={() => setIsMenuOpen(false)}>
                <button
                  type="submit"
                  className="flex items-center space-x-2.5 px-2 py-2 rounded-xl text-xs font-mono text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer w-full text-left font-bold focus:outline-none"
                >
                  <IconLogout className="size-4" />
                  <span className="uppercase tracking-wider text-[10px]">
                    salir
                  </span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* User Card trigger button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center justify-between w-full p-2.5 rounded-xl border border-premium hover:bg-muted/10 transition-all duration-200 text-left cursor-pointer focus:outline-none"
        >
          <div className="flex items-center space-x-3 min-w-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="size-8 rounded-full object-cover border border-accent-soft-border shrink-0"
              />
            ) : (
              <div className="size-8 rounded-full bg-accent-soft-bg border border-accent-soft-border text-accent-soft-fg flex items-center justify-center font-bold font-mono text-xs uppercase shrink-0">
                {profile.full_name ? profile.full_name.substring(0, 2) : "US"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono font-bold truncate text-foreground">
                {profile.full_name?.toLowerCase()}
              </p>
              <p className="text-[9px] text-muted-foreground font-mono truncate">
                divisa: {currency}
              </p>
            </div>
          </div>
          <IconChevronUp
            className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isMenuOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </aside>
  );
}
