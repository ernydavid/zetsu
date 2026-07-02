"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Sidebar } from "@/components/common/sidebar";
import { useAccentTheme, AccentTheme } from "@/components/common/theme-context";
import { signout } from "@/app/auth/actions";
import { sileo } from "sileo";
import {
  updateProfile,
  changePassword,
  clearAllUserDataAction,
} from "@/app/dashboard/actions";
import {
  IconUser,
  IconPalette,
  IconShieldLock,
  IconTrash,
  IconX,
  IconLoader2,
  IconHome,
  IconReceipt,
  IconCreditCard,
  IconChartBar,
  IconLock,
  IconMenu2,
  IconLogout,
  IconSettings,
  IconAlertCircle,
  IconSparkles,
  IconPhoto,
  IconCheck,
} from "@tabler/icons-react";

interface SettingsClientProps {
  profile: any;
  isPro: boolean;
  currency: string;
  errorMsg?: string;
  initialTab?: string;
}

export function SettingsClient({
  profile,
  isPro,
  currency,
  errorMsg,
  initialTab,
}: SettingsClientProps) {
  const router = useRouter();
  const { accentTheme, setAccentTheme } = useAccentTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Settings active tab state
  const [activeTab, setActiveTab] = React.useState<"profile" | "theme" | "security" | "danger">(
    (initialTab === "profile" || initialTab === "theme" || initialTab === "security" || initialTab === "danger")
      ? initialTab
      : "profile"
  );

  React.useEffect(() => {
    if (initialTab === "profile" || initialTab === "theme" || initialTab === "security" || initialTab === "danger") {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Deletion process states
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
  const [showConfigureAgain, setShowConfigureAgain] = React.useState(false);

  // 2FA mock state
  const [is2FAEnabled, setIs2FAEnabled] = React.useState(false);

  // Local notifications
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (errorMsg) {
      const decoded = decodeURIComponent(errorMsg);
      setLocalError(decoded);
      sileo.error({ title: decoded });
      const timer = setTimeout(() => {
        setLocalError(null);
        window.history.replaceState(null, "", window.location.pathname);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const themes: { id: AccentTheme; name: string; class: string }[] = [
    { id: "slate", name: "Slate", class: "bg-slate-400 dark:bg-slate-600" },
    { id: "lavender", name: "Lavender", class: "bg-violet-400 dark:bg-violet-600" },
    { id: "mint", name: "Mint", class: "bg-emerald-400 dark:bg-emerald-600" },
    { id: "sky", name: "Sky", class: "bg-sky-400 dark:bg-sky-600" },
    { id: "peach", name: "Peach", class: "bg-orange-400 dark:bg-orange-600" },
  ];

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProfile(formData);
        sileo.success({ title: "Perfil actualizado con éxito" });
        setLocalSuccess("Perfil actualizado con éxito");
        setTimeout(() => setLocalSuccess(null), 5000);
      } catch (err: any) {
        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        sileo.error({ title: err.message || "Error al actualizar perfil" });
        setLocalError(err.message || "Error al actualizar perfil");
        setTimeout(() => setLocalError(null), 5000);
      }
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await changePassword(formData);
        sileo.success({ title: "Contraseña actualizada con éxito" });
        setLocalSuccess("Contraseña actualizada con éxito");
        setTimeout(() => setLocalSuccess(null), 5000);
        e.currentTarget.reset();
      } catch (err: any) {
        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        sileo.error({ title: err.message || "Error al actualizar contraseña" });
        setLocalError(err.message || "Error al actualizar contraseña");
        setTimeout(() => setLocalError(null), 5000);
      }
    });
  };

  const handleClearDataConfirm = (configureAgain: boolean) => {
    startTransition(async () => {
      try {
        await clearAllUserDataAction(configureAgain);
        sileo.success({ title: "Todos tus datos han sido borrados" });
        setShowConfigureAgain(false);
        if (configureAgain) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      } catch (err: any) {
        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        sileo.error({ title: err.message || "Error al borrar los datos" });
      }
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col lg:flex-row font-sans">
      {/* 1. LEFT SIDEBAR NAVIGATION (Desktop) */}
      <Sidebar activeTab="settings" profile={profile} currency={currency} />

      {/* 2. MOBILE HEADER & NAVIGATION */}
      <header className="lg:hidden border-b border-premium bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <span className="font-heading-style text-xl font-black tracking-tighter">
            zetsu<span className="text-accent-soft-fg font-serif">.</span>
          </span>
          <span className="text-[9px] font-mono px-2 py-0.2 border border-accent-soft-border rounded-full bg-accent-soft-bg text-accent-soft-fg uppercase font-bold">
            {profile.billing_tier}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Abrir menú"
          >
            <IconMenu2 className="size-4" />
          </Button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-8">
            <span className="font-heading-style text-xl font-black tracking-tighter">zetsu.</span>
            <Button size="icon-sm" variant="outline" onClick={() => setIsMobileMenuOpen(false)}>
              <IconX className="size-4" />
            </Button>
          </div>

          <nav className="space-y-4 flex-1">
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground hover:bg-muted/10 transition-all duration-200"
            >
              <IconHome className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">dashboard</span>
            </Link>

            <Link
              href="/dashboard/transactions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground hover:bg-muted/10 transition-all duration-200"
            >
              <IconReceipt className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">transacciones</span>
            </Link>

            <Link
              href="/dashboard/subscriptions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground hover:bg-muted/10 transition-all duration-200"
            >
              <IconCreditCard className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">suscripciones</span>
            </Link>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl text-muted-foreground opacity-60">
              <span className="flex items-center space-x-3">
                <IconChartBar className="size-4" />
                <span className="font-mono uppercase tracking-wider text-xs">proyecciones (pro)</span>
              </span>
              <IconLock className="size-3" />
            </div>

            <Link
              href="/dashboard/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border text-sm font-medium transition-all duration-200"
            >
              <IconSettings className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">ajustes</span>
            </Link>
          </nav>

          <div className="border-t border-premium pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-bold">{profile.full_name?.toLowerCase()}</p>
              <p className="text-[10px] text-muted-foreground font-mono">divisa: {currency}</p>
            </div>
            <form action={signout}>
              <Button size="sm" variant="outline" className="gap-1.5 uppercase font-mono text-[10px]">
                <IconLogout className="size-3.5" /> salir
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8 lg:py-12 space-y-8">
          {/* Header */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
              /panel_de_control
            </span>
            <h1 className="font-heading-style text-3xl font-black tracking-tight text-foreground lowercase">
              ajustes y configuración
            </h1>
          </div>

          {/* Local notification banner */}
          {(localError || localSuccess) && (
            <div>
              {localError && (
                <div className="p-3 border border-destructive bg-destructive/5 text-destructive text-xs font-mono rounded-xl flex items-center gap-2">
                  <IconAlertCircle className="size-4 shrink-0" />
                  <span>[ERROR]: {localError}</span>
                </div>
              )}
              {localSuccess && (
                <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-mono rounded-xl flex items-center gap-2 font-bold uppercase tracking-wider">
                  <IconSparkles className="size-4 text-emerald-500 animate-pulse" />
                  <span>[!] {localSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* Tabs Navigation and Card Content */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {/* Navigation links (Tabs) */}
            <div className="flex md:flex-col overflow-x-auto md:overflow-visible gap-2 pb-2 md:pb-0 border-b md:border-b-0 border-border">
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-left shrink-0 transition-colors cursor-pointer w-full ${
                  activeTab === "profile"
                    ? "bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border"
                    : "text-muted-foreground hover:bg-muted/10"
                }`}
              >
                <IconUser className="size-4" />
                <span>perfil</span>
              </button>

              <button
                onClick={() => setActiveTab("theme")}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-left shrink-0 transition-colors cursor-pointer w-full ${
                  activeTab === "theme"
                    ? "bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border"
                    : "text-muted-foreground hover:bg-muted/10"
                }`}
              >
                <IconPalette className="size-4" />
                <span>tema</span>
              </button>

              <button
                onClick={() => setActiveTab("security")}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-left shrink-0 transition-colors cursor-pointer w-full ${
                  activeTab === "security"
                    ? "bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border"
                    : "text-muted-foreground hover:bg-muted/10"
                }`}
              >
                <IconShieldLock className="size-4" />
                <span>seguridad</span>
              </button>

              <button
                onClick={() => setActiveTab("danger")}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-left shrink-0 transition-colors cursor-pointer w-full ${
                  activeTab === "danger"
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "text-muted-foreground hover:bg-muted/10"
                }`}
              >
                <IconTrash className="size-4" />
                <span>zona de peligro</span>
              </button>
            </div>

            {/* Active Tab Panel Content */}
            <div className="md:col-span-3">
              <Card className="bg-card border border-premium shadow-premium">
                <CardContent className="p-6">
                  {activeTab === "profile" && (
                    <form onSubmit={handleProfileSubmit} className="space-y-4 font-mono text-xs">
                      <div className="space-y-1">
                        <Label htmlFor="profile-name" className="text-[10px] font-bold uppercase">Nombre Completo</Label>
                        <Input
                          id="profile-name"
                          name="full_name"
                          type="text"
                          defaultValue={profile.full_name}
                          required
                          placeholder="Nombre del usuario"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="profile-avatar" className="text-[10px] font-bold uppercase">URL de Foto de Perfil</Label>
                        <div className="flex gap-2">
                          <Input
                            id="profile-avatar"
                            name="avatar_url"
                            type="url"
                            defaultValue={profile.avatar_url || ""}
                            placeholder="https://ejemplo.com/foto.jpg"
                            className="flex-1"
                          />
                          <div className="size-10 rounded-xl border border-premium flex items-center justify-center shrink-0 bg-muted/10">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt="Vista previa" className="size-8 rounded-full object-cover" />
                            ) : (
                              <IconPhoto className="size-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="profile-tagline" className="text-[10px] font-bold uppercase">Lema Personal</Label>
                        <Input
                          id="profile-tagline"
                          name="tagline"
                          type="text"
                          defaultValue={profile.tagline || ""}
                          placeholder="Ej: Solo ahorra lo que te queda después de gastar"
                          maxLength={80}
                        />
                        <p className="text-[9px] text-muted-foreground">
                          Aparecerá en cursiva en el encabezado del Dashboard debajo de tu nombre.
                        </p>
                      </div>

                      <div className="pt-2">
                        <Button type="submit" disabled={isPending} className="w-full justify-center">
                          {isPending && <IconLoader2 className="size-4 mr-2 animate-spin" />}
                          guardar perfil
                        </Button>
                      </div>
                    </form>
                  )}

                  {activeTab === "theme" && (
                    <div className="space-y-4 font-mono text-xs">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold lowercase">/personalizar_tema</h3>
                        <p className="text-[10px] text-muted-foreground">
                          Elige un color de acento suave para teñir botones, tarjetas destacadas e indicadores contables.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                        {themes.map((theme) => {
                          const isActive = accentTheme === theme.id;
                          return (
                            <button
                              key={theme.id}
                              onClick={() => {
                                setAccentTheme(theme.id);
                                sileo.success({ title: `Tema acento cambiado a ${theme.name}` });
                              }}
                              className={`flex flex-col items-center justify-center p-4 border rounded-2xl cursor-pointer transition-all duration-200 ${
                                isActive
                                  ? "bg-accent-soft-bg border-accent-soft-border text-accent-soft-fg scale-105"
                                  : "border-premium bg-card hover:bg-muted/10 text-muted-foreground"
                              }`}
                            >
                              <div className={`size-8 rounded-full ${theme.class} mb-2 shadow-inner border border-black/10`} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">{theme.name}</span>
                              {isActive && <IconCheck className="size-3 mt-1 text-accent-soft-fg" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === "security" && (
                    <div className="space-y-6 font-mono text-xs">
                      <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold lowercase">/cambiar_contraseña</h3>
                          <p className="text-[10px] text-muted-foreground">
                            Establece una nueva clave de acceso para tu cuenta de Zetsu.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="security-pwd" className="text-[10px] font-bold uppercase">Nueva Contraseña</Label>
                            <Input
                              id="security-pwd"
                              name="password"
                              type="password"
                              required
                              placeholder="Mínimo 6 caracteres"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="security-pwd-conf" className="text-[10px] font-bold uppercase">Confirmar Contraseña</Label>
                            <Input
                              id="security-pwd-conf"
                              name="confirm_password"
                              type="password"
                              required
                              placeholder="Confirmación"
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button type="submit" disabled={isPending} className="w-full justify-center">
                            {isPending && <IconLoader2 className="size-4 mr-2 animate-spin" />}
                            actualizar contraseña
                          </Button>
                        </div>
                      </form>

                      <div className="border-t border-premium pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1 max-w-sm">
                            <h3 className="text-sm font-bold lowercase">autenticación de doble factor (2FA)</h3>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              Añade una capa extra de seguridad a tu cuenta solicitando un código de autenticación TOTP de tu dispositivo móvil al iniciar sesión.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIs2FAEnabled(!is2FAEnabled);
                              sileo.success({
                                title: is2FAEnabled ? "2FA simulado desactivado" : "2FA simulado activado con éxito",
                              });
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              is2FAEnabled ? "bg-accent-soft-fg" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                                is2FAEnabled ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {is2FAEnabled && (
                          <div className="p-4 bg-accent-soft-bg/40 border border-accent-soft-border/50 rounded-xl space-y-3 animate-scale-up">
                            <p className="font-bold text-[10px] text-accent-soft-fg uppercase">🛡️ Configuración de TOTP MFA:</p>
                            <p className="text-[9px] text-muted-foreground leading-normal">
                              Para finalizar la activación, escanea el código de barras siguiente en tu aplicación autenticadora (Google Authenticator, Authy, etc.):
                            </p>
                            <div className="size-32 bg-white p-2 rounded-lg mx-auto border border-premium flex items-center justify-center">
                              {/* Standard mockup QR Code layout */}
                              <div className="grid grid-cols-4 gap-1 size-full opacity-80">
                                {Array.from({ length: 16 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`rounded-sm ${
                                      (i * 7) % 3 === 0 || i === 0 || i === 3 || i === 12 || i === 15
                                        ? "bg-slate-900"
                                        : "bg-slate-100"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-[9px] text-center font-mono text-muted-foreground select-all">
                              Clave secreta: ZETSU-MFA-MOCK-SECRET-KEY-2026
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "danger" && (
                    <div className="space-y-4 font-mono text-xs">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-destructive lowercase">/borrar_toda_la_informacion</h3>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Esta acción es irreversible. Eliminará permanentemente todas tus transacciones registradas, plantillas de ingresos y cobros recurrentes de suscripciones de la base de datos.
                        </p>
                      </div>

                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="destructive"
                          className="w-full justify-center gap-1.5 py-2.5"
                          onClick={() => setShowConfirmDelete(true)}
                          disabled={isPending}
                        >
                          <IconTrash className="size-4" /> borrar todos mis datos
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: Confirm Delete Data */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in px-4">
          <Card className="max-w-sm w-full bg-card border border-premium shadow-premium-lg relative animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading-style text-sm font-bold tracking-tight text-destructive lowercase flex items-center gap-1.5">
                <IconAlertCircle className="size-4" />
                /confirmar_borrado
              </h3>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setShowConfirmDelete(false)}
                aria-label="Cerrar modal"
                disabled={isPending}
              >
                <IconX className="size-4" />
              </Button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <p className="text-muted-foreground leading-relaxed">
                ¿Estás completamente seguro de que deseas eliminar **todos tus ingresos, cobros recurrentes y transacciones** de Zetsu? Esta acción no se puede deshacer.
              </p>

              <div className="pt-2 flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-center py-2"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isPending}
                >
                  cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1 justify-center py-2 gap-1.5"
                  onClick={() => {
                    setShowConfirmDelete(false);
                    setShowConfigureAgain(true); // Open the configuration dialog modal
                  }}
                  disabled={isPending}
                >
                  borrar todo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: Configure Again Dialog */}
      {showConfigureAgain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in px-4">
          <Card className="max-w-sm w-full bg-card border border-premium shadow-premium-lg relative animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading-style text-sm font-bold tracking-tight text-foreground lowercase flex items-center gap-1.5">
                <IconSparkles className="size-4 text-accent-soft-fg" />
                /configurar_de_nuevo
              </h3>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <p className="text-muted-foreground leading-relaxed font-bold">
                ¡Información eliminada con éxito!
              </p>
              <p className="text-muted-foreground leading-relaxed">
                ¿Deseas volver a configurar tu aplicación Zetsu desde cero ahora mismo? Si eliges **Sí**, te redirigiremos al onboarding multipaso. Si eliges **No**, volverás al dashboard limpio.
              </p>

              <div className="pt-2 flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-center py-2"
                  onClick={() => handleClearDataConfirm(false)}
                  disabled={isPending}
                >
                  no, ir al dashboard
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="flex-1 justify-center py-2 gap-1.5"
                  onClick={() => handleClearDataConfirm(true)}
                  disabled={isPending}
                >
                  {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
                  sí, configurar (onboarding)
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
