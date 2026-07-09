"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppLogo } from "@/components/common/app-logo";
import { AnimatedModal } from "@/components/common/animated-modal";
import { CategoryLibraryInput } from "@/components/common/category-library-input";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Sidebar } from "@/components/common/sidebar";
import { useAccentTheme, AccentTheme } from "@/components/common/theme-context";
import { todayLocalIso } from "@/lib/finance/dates";
import { signout } from "@/app/auth/actions";
import { sileo } from "sileo";
import { SubscriptionFrequencySelect } from "@/components/common/frequency-select";
import {
  addPayment,
  editSubscription,
  deleteSubscription,
} from "@/app/dashboard/actions";
import {
  IconSearch,
  IconPlus,
  IconPencil,
  IconTrash,
  IconLogout,
  IconLock,
  IconChartBar,
  IconReceipt,
  IconSettings,
  IconHome,
  IconMenu2,
  IconX,
  IconLoader2,
  IconAlertCircle,
  IconCreditCard,
  IconSparkles,
} from "@tabler/icons-react";

interface SubscriptionsClientProps {
  profile: any;
  subscriptions: any[];
  expenseCategoryLibrary: string[];
  isPro: boolean;
  currency: string;
}

export function SubscriptionsClient({
  profile,
  subscriptions = [],
  expenseCategoryLibrary,
  isPro,
  currency,
}: SubscriptionsClientProps) {
  const { accentTheme, setAccentTheme } = useAccentTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Search state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // Modals state
  const [activeModal, setActiveModal] = React.useState<"payment" | null>(null);
  const [editingSubscription, setEditingSubscription] = React.useState<any | null>(null);
  const [isExpenseRecurring, setIsExpenseRecurring] = React.useState(true); // Always true on this page by default

  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const [expenseFrequency, setExpenseFrequency] = React.useState<string>("monthly");
  const [expenseDay, setExpenseDay] = React.useState<string>("");
  const [subscriptionCategoryValue, setSubscriptionCategoryValue] = React.useState("servicios");

  React.useEffect(() => {
    if (editingSubscription) {
      setExpenseFrequency(editingSubscription.billing_cycle || "monthly");
      setSubscriptionCategoryValue(editingSubscription.category || "servicios");
      if (editingSubscription.next_payment_date) {
        const d = new Date(editingSubscription.next_payment_date);
        const day = d.getUTCDate();
        const baseDay = editingSubscription.billing_cycle === "bi-weekly" ? (day > 15 ? day - 15 : day) : day;
        setExpenseDay(String(baseDay));
      } else {
        setExpenseDay(String(new Date().getUTCDate()));
      }
    } else {
      setExpenseFrequency("monthly");
      setExpenseDay(String(new Date().getUTCDate()));
      setSubscriptionCategoryValue("servicios");
    }
  }, [editingSubscription]);

  React.useEffect(() => {
    if (expenseFrequency === "bi-weekly") {
      const parsed = parseInt(expenseDay);
      if (!isNaN(parsed) && parsed > 15) {
        setExpenseDay("15");
      }
    }
  }, [expenseFrequency, expenseDay]);

  // Debounce search effect (500ms)
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysLeftText = (dueDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `venció hace ${Math.abs(diffDays)}d`;
    }
    if (diffDays === 0) {
      return "vence hoy";
    }
    if (diffDays === 1) {
      return "mañana";
    }
    return `${diffDays} días rest.`;
  };

  const translateFrequency = (freq: string) => {
    switch (freq) {
      case "daily": return "diario";
      case "weekly": return "semanal";
      case "bi-weekly": return "quincenal";
      case "monthly": return "mensual";
      case "yearly": return "anual";
      default: return freq;
    }
  };

  // Filter subscriptions by search
  const filteredSubscriptions = React.useMemo(() => {
    if (debouncedSearch.trim() === "") {
      return subscriptions;
    }
    const query = debouncedSearch.toLowerCase();
    return subscriptions.filter(
      (sub) =>
        sub.name.toLowerCase().includes(query) ||
        (sub.category || "").toLowerCase().includes(query)
    );
  }, [subscriptions, debouncedSearch]);

  const handleAction = async (
    actionFn: (fd: FormData) => Promise<void>,
    fd: FormData,
    successMessage: string
  ) => {
    startTransition(async () => {
      try {
        await actionFn(fd);
        sileo.success({ title: successMessage });
        setActiveModal(null);
        setEditingSubscription(null);
      } catch (err: any) {
        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        sileo.error({ title: err.message || "Ocurrió un error inesperado" });
      }
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteSubscription(deleteTarget.id);
        sileo.success({ title: "Suscripción eliminada con éxito" });
        setDeleteTarget(null);
      } catch (err: any) {
        sileo.error({ title: err.message || "Error al eliminar la suscripción" });
      }
    });
  };

  const themes: { id: AccentTheme; name: string; class: string }[] = [
    { id: "slate", name: "Slate", class: "bg-slate-400 dark:bg-slate-600" },
    { id: "lavender", name: "Lavender", class: "bg-violet-400 dark:bg-violet-600" },
    { id: "mint", name: "Mint", class: "bg-emerald-400 dark:bg-emerald-600" },
    { id: "sky", name: "Sky", class: "bg-sky-400 dark:bg-sky-600" },
    { id: "peach", name: "Peach", class: "bg-orange-400 dark:bg-orange-600" },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col lg:flex-row font-sans">
      {/* 1. LEFT SIDEBAR NAVIGATION (Desktop) */}
      <Sidebar activeTab="subscriptions" profile={profile} currency={currency} />

      {/* 2. MOBILE HEADER & NAVIGATION */}
      <header className="lg:hidden border-b border-premium bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <AppLogo size="sm" variant="full" priority />
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
            <AppLogo size="sm" variant="full" />
            <Button size="icon-sm" variant="outline" onClick={() => setIsMobileMenuOpen(false)}>
              <IconX className="size-4" />
            </Button>
          </div>

          <nav className="space-y-4 flex-1">
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground"
            >
              <IconHome className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">dashboard</span>
            </Link>

            <Link
              href="/dashboard/transactions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground"
            >
              <IconReceipt className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">transacciones</span>
            </Link>

            <Link
              href="/dashboard/subscriptions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border text-sm font-medium"
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
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground hover:bg-muted/10 transition-all duration-200"
            >
              <IconSettings className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">ajustes</span>
            </Link>
          </nav>
        </div>
      )}

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8 lg:py-12 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                /automatizacion_financiera
              </span>
              <h1 className="font-heading-style text-3xl font-black tracking-tight text-accent-soft-fg lowercase">
                gestión de pagos recurrentes
              </h1>
            </div>
            {isPro && (
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  setEditingSubscription(null);
                  setIsExpenseRecurring(true);
                  setActiveModal("payment");
                }}
                className="gap-1.5 uppercase font-mono text-xs w-full sm:w-auto justify-center"
              >
                <IconPlus className="size-4" /> registrar pago recurrente
              </Button>
            )}
          </div>

          {!isPro ? (
            /* Premium Dark Paywall for Free Tier Users with blurred mockup templates behind */
            <div className="relative border border-premium rounded-2xl overflow-hidden min-h-[450px] flex items-center justify-center p-8 bg-card/30">
              {/* Blurred Mockup Content */}
              <div className="absolute inset-0 select-none pointer-events-none filter blur-sm opacity-20 divide-y divide-border/60">
                <div className="p-4 flex items-center justify-between">
                  <div className="font-mono text-xs">netflix streaming</div>
                  <div className="font-mono text-xs">17,99 € / mes</div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="font-mono text-xs">spotify premium</div>
                  <div className="font-mono text-xs">10,99 € / mes</div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="font-mono text-xs">alquiler piso</div>
                  <div className="font-mono text-xs">850,00 € / mes</div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="font-mono text-xs">gimnasio gofit</div>
                  <div className="font-mono text-xs">39,90 € / mes</div>
                </div>
              </div>

              {/* Glassmorphic Paywall Card */}
              <Card className="max-w-md w-full border border-premium/80 bg-background/60 backdrop-blur-xl shadow-premium-lg z-10">
                <CardContent className="p-8 text-center space-y-6">
                  <div className="size-12 rounded-full bg-accent-soft-bg border border-accent-soft-border text-accent-soft-fg flex items-center justify-center mx-auto">
                    <IconLock className="size-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-heading-style text-lg font-black tracking-tight lowercase">
                      desbloquea la automatización
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                      Con el plan <strong className="text-accent-soft-fg uppercase">pro</strong>, Zetsu debitará automáticamente tus gastos fijos y suscripciones en las fechas indicadas, generando movimientos en tu historial para una trazabilidad perfecta.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="soft"
                      className="w-full justify-center py-2.5 font-mono text-xs uppercase gap-1.5"
                      onClick={() => {
                        window.location.href = "/api/checkout/stripe?simulated=true";
                      }}
                    >
                      <IconSparkles className="size-4 animate-pulse" /> obtener plan pro
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Active Subscriptions Dashboard for PRO users */
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative w-full md:max-w-md">
                <IconSearch className="absolute left-3.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por concepto o categoría..."
                  className="pl-10 font-mono text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground"
                  >
                    <IconX className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Subscriptions Table */}
              <div className="bg-card border border-premium shadow-premium rounded-2xl overflow-hidden">
                <div className="divide-y divide-border/60">
                  {filteredSubscriptions.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground font-mono text-xs space-y-2">
                      <p>[!] no hay pagos recurrentes registrados</p>
                      <p className="text-[10px] opacity-75">
                        {searchTerm ? "Prueba con otra palabra clave." : "Comienza registrando tu primer pago automático."}
                      </p>
                    </div>
                  ) : (
                    filteredSubscriptions.map((sub) => {
                      const daysLeftText = getDaysLeftText(new Date(sub.next_payment_date));
                      const isVencido = daysLeftText.startsWith("venció");
                      const isHoy = daysLeftText === "vence hoy";

                      return (
                        <div
                          key={sub.id}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/5 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-foreground truncate">
                                {sub.name.toLowerCase()}
                              </span>
                              <span className="text-[8px] font-mono font-bold uppercase px-2 py-0.5 border border-border rounded bg-muted/35 text-muted-foreground">
                                {sub.category || "servicios"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                              <span>frecuencia: {translateFrequency(sub.billing_cycle)}</span>
                              <span>•</span>
                              <span
                                className={`${
                                  isHoy
                                    ? "text-amber-500 font-bold"
                                    : isVencido
                                    ? "text-destructive font-bold animate-pulse"
                                    : "text-muted-foreground"
                                }`}
                              >
                                prox. cobro: {formatDate(sub.next_payment_date)} ({daysLeftText})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                            <div className="font-mono text-xs font-bold text-destructive">
                              -{formatMoney(Number(sub.amount))}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon-xs"
                                variant="outline"
                                onClick={() => {
                                  setEditingSubscription(sub);
                                  setIsExpenseRecurring(true);
                                  setActiveModal("payment");
                                }}
                                aria-label={`Editar ${sub.name}`}
                              >
                                <IconPencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget({ id: sub.id, name: sub.name })}
                                aria-label={`Eliminar ${sub.name}`}
                              >
                                <IconTrash className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 4. MODALS CONTAINER */}
      {activeModal === "payment" && (
        <AnimatedModal
          open={activeModal === "payment"}
          overlayClassName="flex items-center justify-center bg-background/80 backdrop-blur-md px-4"
          panelClassName="max-w-md w-full"
        >
          <Card className="max-w-md w-full bg-card border border-premium shadow-premium-lg relative">
            <button
              onClick={() => {
                setActiveModal(null);
                setEditingSubscription(null);
              }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <IconX className="size-4" />
            </button>

            <div className="mb-4">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block font-bold">
                {editingSubscription ? "/editar_suscripcion" : "/registrar_suscripcion"}
              </span>
              <h2 className="font-heading-style text-lg font-black tracking-tight text-foreground lowercase">
                {editingSubscription ? "editar pago recurrente" : "nuevo pago recurrente"}
              </h2>
            </div>

            <form
              key={editingSubscription ? `edit-${editingSubscription.id}` : "new"}
              action={(fd) => handleAction(
                editingSubscription ? editSubscription : addPayment,
                fd,
                editingSubscription ? "Pago recurrente actualizado con éxito" : "Pago recurrente registrado con éxito"
              )}
              className="space-y-4 font-mono text-xs"
            >
              {editingSubscription && (
                <input type="hidden" name="id" value={editingSubscription.id} />
              )}
              <div className="space-y-1">
                <Label htmlFor="modal-title" className="text-[10px] font-bold uppercase">Concepto del Gasto</Label>
                <Input
                  id="modal-title"
                  name={editingSubscription ? "name" : "title"}
                  placeholder="Internet Fibra"
                  defaultValue={editingSubscription?.name || ""}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-pay-amount" className="text-[10px] font-bold uppercase">Monto ({currency})</Label>
                <Input
                  id="modal-pay-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="45"
                  defaultValue={editingSubscription?.amount || ""}
                  required
                />
              </div>

              <CategoryLibraryInput
                id="subscriptions-category"
                name="category"
                label="Categoría"
                value={subscriptionCategoryValue}
                onChange={setSubscriptionCategoryValue}
                categories={expenseCategoryLibrary}
                placeholder="servicios"
                helperText="Elige una categoría sugerida o escribe una nueva para guardarla."
              />

              {/* Toggle Recurrente (Always forced to True since we are inside subscriptions module) */}
              <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase block">¿Es recurrente? (Suscripción)</span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {isExpenseRecurring ? "Se debita periódicamente" : "Pago de una sola vez"}
                  </span>
                </div>
                <Switch
                  checked={isExpenseRecurring}
                  onCheckedChange={setIsExpenseRecurring}
                  aria-label="Alternar suscripción recurrente"
                />
                <input type="hidden" name="is_recurring" value={isExpenseRecurring ? "true" : "false"} />
              </div>

              {isExpenseRecurring ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-sub-freq" className="text-[10px] font-bold uppercase">Frecuencia de Cobro</Label>
                    <SubscriptionFrequencySelect
                      id="modal-sub-freq"
                      name="billing_cycle"
                      value={expenseFrequency}
                      onChange={(e) => setExpenseFrequency(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-sub-day" className="text-[10px] font-bold uppercase">Día del Mes</Label>
                    <Input
                      id="modal-sub-day"
                      name="day_of_month"
                      type="number"
                      min="1"
                      max={expenseFrequency === "bi-weekly" ? "15" : "31"}
                      placeholder="5"
                      value={expenseDay}
                      onChange={(e) => {
                        const val = e.target.value;
                        const parsed = parseInt(val);
                        const maxVal = expenseFrequency === "bi-weekly" ? 15 : 31;
                        if (val === "") {
                          setExpenseDay("");
                        } else if (!isNaN(parsed)) {
                          setExpenseDay(String(Math.max(1, Math.min(maxVal, parsed))));
                        }
                      }}
                      required
                    />
                  </div>
                  {expenseFrequency === "bi-weekly" && (
                    <p className="col-span-2 text-[10px] text-accent-soft-fg font-mono mt-1 leading-relaxed">
                      💡 Los pagos se realizarán los días {parseInt(expenseDay) || 1} y {(parseInt(expenseDay) || 1) + 15} de cada mes.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="modal-pay-date" className="text-[10px] font-bold uppercase">Fecha de Gasto</Label>
                  <Input
                    id="modal-pay-date"
                    name="next_pay_date"
                    type="date"
                    defaultValue={todayLocalIso()}
                    required
                  />
                </div>
              )}

              <div className="pt-2 flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-center py-2"
                  onClick={() => {
                    setActiveModal(null);
                    setEditingSubscription(null);
                  }}
                  disabled={isPending}
                >
                  cancelar
                </Button>
                <Button
                  type="submit"
                  variant="soft"
                  className="flex-1 justify-center py-2 gap-1.5"
                  disabled={isPending}
                >
                  {isPending ? (
                    <IconLoader2 className="size-3.5 animate-spin" />
                  ) : editingSubscription ? (
                    <IconPencil className="size-3.5" />
                  ) : (
                    <IconPlus className="size-3.5" />
                  )}
                  {editingSubscription ? "guardar" : "agregar"}
                </Button>
              </div>
            </form>
          </Card>
        </AnimatedModal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <AnimatedModal
          open={!!deleteTarget}
          overlayClassName="flex items-center justify-center bg-background/80 backdrop-blur-md px-4"
          panelClassName="max-w-sm w-full"
        >
          <Card className="max-w-sm w-full bg-card border border-premium shadow-premium-lg relative font-mono text-xs">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading-style text-sm font-bold tracking-tight text-foreground lowercase flex items-center gap-1.5">
                <IconAlertCircle className="size-4 text-destructive" />
                /confirmar_eliminacion
              </h3>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                aria-label="Cerrar modal"
              >
                <IconX className="size-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                ¿Estás seguro de que deseas archivar el pago recurrente de <strong className="text-foreground">"{deleteTarget.name.toLowerCase()}"</strong>? Solo se cancelarán las ocurrencias futuras pendientes; el historial ya registrado se conservará.
              </p>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  className="flex-1 justify-center py-2"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                >
                  cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 justify-center py-2 gap-1.5"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? (
                    <IconLoader2 className="size-3.5 animate-spin" />
                  ) : (
                    <IconTrash className="size-3.5" />
                  )}
                  eliminar
                </Button>
              </div>
            </div>
          </Card>
        </AnimatedModal>
      )}
    </div>
  );
}
