"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Sidebar } from "@/components/common/sidebar";
import { useAccentTheme, AccentTheme } from "@/components/common/theme-context";
import { signout } from "@/app/auth/actions";
import { sileo } from "sileo";
import {
  deleteIncome,
  togglePaymentStatus,
  deletePayment,
  deleteSubscription,
} from "@/app/dashboard/actions";
import {
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconChevronLeft,
  IconChevronRight,
  IconAlertCircle,
  IconX,
  IconTrash,
  IconLoader2,
  IconHome,
  IconReceipt,
  IconChartBar,
  IconSettings,
  IconLogout,
  IconLock,
  IconMenu2,
  IconCreditCard,
} from "@tabler/icons-react";

interface TransactionsClientProps {
  profile: any;
  incomes: any[];
  payments: any[];
  subscriptions: any[];
  isPro: boolean;
  currency: string;
}

export function TransactionsClient({
  profile,
  incomes = [],
  payments = [],
  subscriptions = [],
  isPro,
  currency,
}: TransactionsClientProps) {
  const { accentTheme, setAccentTheme } = useAccentTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Search & Filter States
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [filterType, setFilterType] = React.useState<"all" | "income" | "payment" | "subscription">("all");
  const [sortByDate, setSortByDate] = React.useState<"desc" | "asc">("desc");

  // Pagination States
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  // Deletion Target State
  const [deleteTarget, setDeleteTarget] = React.useState<{
    title: string;
    type: "income" | "payment" | "subscription";
    action: () => Promise<void>;
  } | null>(null);



  // Debounce search effect (500ms)
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on search
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

  // Compile all transactions into a unified log from payments (which contains the transactions ledger)
  const allTransactions = React.useMemo(() => {
    return (payments || []).map((tx) => {
      let type: "income" | "payment" | "subscription" = "payment";
      let category = tx.category || "gasto";
      let action = deletePayment.bind(null, tx.id);

      if (tx.amount > 0) {
        type = "income";
        category = "ingreso";
      } else if (tx.source_type === "subscription_recurring") {
        type = "subscription";
        category = tx.category || "suscripción";
      } else {
        type = "payment";
        category = tx.category || "gasto";
      }

      const rawSub = tx.source_type === "subscription_recurring"
        ? (subscriptions || []).find((s) => s.id === tx.source_id)
        : null;

      return {
        id: tx.id,
        title: tx.title,
        type,
        amount: Number(tx.amount), // positive for income, negative for expenses/subscriptions
        date: new Date(tx.date || tx.created_at || Date.now()),
        displayDate: tx.date ? new Date(tx.date) : new Date(tx.created_at || Date.now()),
        category,
        status: tx.status,
        action,
        raw: rawSub, // for editing/viewing subscription template if needed
      };
    });
  }, [payments, subscriptions]);

  // Filter & Search & Sort
  const filteredAndSorted = React.useMemo(() => {
    let result = [...allTransactions];

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((tx) => tx.type === filterType);
    }

    // Filter by search term
    if (debouncedSearch.trim() !== "") {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.title.toLowerCase().includes(query) ||
          tx.category.toLowerCase().includes(query)
      );
    }

    // Sort by date
    result.sort((a, b) => {
      const timeA = a.displayDate.getTime();
      const timeB = b.displayDate.getTime();
      return sortByDate === "desc" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [allTransactions, filterType, debouncedSearch, sortByDate]);

  // Pagination Math
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const paginatedTransactions = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSorted, currentPage]);

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
      <Sidebar activeTab="transactions" profile={profile} currency={currency} />

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
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground"
            >
              <IconHome className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">dashboard</span>
            </Link>

            <Link
              href="/dashboard/transactions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border text-sm font-medium"
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
          <div className="space-y-1">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
              /registro_financiero
            </span>
            <h1 className="font-heading-style text-3xl font-black tracking-tight text-foreground lowercase">
              historial de transacciones
            </h1>
          </div>

          {/* Filters, Search & Sorting Panel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

            {/* Type Filters and Sort */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-muted/30 p-1 border border-premium rounded-xl font-mono text-[10px]">
                {(["all", "income", "payment", "subscription"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setFilterType(type);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 uppercase font-bold rounded-lg transition-colors cursor-pointer ${
                      filterType === type
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {type === "all"
                      ? "todos"
                      : type === "income"
                      ? "ingresos"
                      : type === "payment"
                      ? "pagos"
                      : "suscrip."}
                  </button>
                ))}
              </div>

              {/* Date Sort Order Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortByDate(sortByDate === "desc" ? "asc" : "desc")}
                className="gap-1.5 font-mono text-[10px]"
              >
                fecha: {sortByDate === "desc" ? "recientes" : "antiguas"}
                {sortByDate === "desc" ? (
                  <IconArrowDown className="size-3" />
                ) : (
                  <IconArrowUp className="size-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Transactions Table/List Card */}
          <div className="bg-card border border-premium shadow-premium rounded-2xl overflow-hidden">
            <div className="divide-y divide-border/60">
              {paginatedTransactions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-mono text-xs space-y-2">
                  <p>[!] no se encontraron transacciones</p>
                  <p className="text-[10px] opacity-75">Prueba a escribir otro concepto o a cambiar el filtro por tipo.</p>
                </div>
              ) : (
                paginatedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between p-4 hover:bg-muted/5 transition-colors ${
                      tx.type === "payment" && tx.status === "paid" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Badge representation */}
                      <div className={`size-8 rounded-full flex items-center justify-center font-bold text-xs font-mono uppercase shrink-0 ${
                        tx.type === "income"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : tx.type === "subscription"
                          ? "bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border/30"
                          : "bg-muted/20 text-muted-foreground border border-border"
                      }`}>
                        {tx.title.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-foreground truncate">
                          {tx.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 border rounded-md uppercase ${
                            tx.type === "income"
                              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
                              : tx.type === "subscription"
                              ? "border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg"
                              : "border-border bg-muted/10 text-muted-foreground"
                          }`}>
                            {tx.type === "income" ? "ingreso" : tx.type === "subscription" ? "suscripción" : "gasto"}
                          </span>
                          <span className="text-[8px] text-muted-foreground font-mono uppercase">
                            • {tx.category} • {formatDate(tx.displayDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0">
                      <span className={`text-xs font-mono font-bold ${
                        tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}>
                        {tx.type === "income" ? "+" : "-"}
                        {formatMoney(Math.abs(tx.amount))}
                      </span>

                      {(tx.type === "payment" || tx.type === "subscription") && (
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await togglePaymentStatus(tx.id, tx.status || "unpaid");
                                sileo.success({
                                  title: `Pago marcado como ${
                                    tx.status === "paid" ? "pendiente" : "pagado"
                                  }`,
                                });
                              } catch (err: any) {
                                if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
                                  throw err;
                                }
                                sileo.error({ title: err.message || "Error al actualizar estado" });
                              }
                            });
                          }}
                          className={`text-[9px] font-mono px-2 py-0.5 border cursor-pointer ${
                            tx.status === "paid"
                              ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5 font-bold"
                              : "border-border text-muted-foreground"
                          } rounded-md hover:opacity-80 transition-opacity`}
                          disabled={isPending}
                        >
                          {tx.status === "paid" ? "PAGADO" : "PENDIENTE"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget({
                            title: tx.title,
                            type: tx.type,
                            action: tx.action,
                          });
                        }}
                        className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                        aria-label="Eliminar"
                        disabled={isPending}
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination Controls */}
          {filteredAndSorted.length > pageSize && (
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground text-[10px]">
                mostrando {Math.min(filteredAndSorted.length, (currentPage - 1) * pageSize + 1)}-
                {Math.min(filteredAndSorted.length, currentPage * pageSize)} de {filteredAndSorted.length} transacciones
              </span>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon-xs"
                  disabled={currentPage === 1 || isPending}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  aria-label="Página anterior"
                >
                  <IconChevronLeft className="size-3.5" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`size-6 rounded-lg font-bold text-[10px] transition-colors cursor-pointer border ${
                      currentPage === page
                        ? "bg-foreground text-background border-foreground"
                        : "border-premium text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <Button
                  variant="outline"
                  size="icon-xs"
                  disabled={currentPage === totalPages || isPending}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  aria-label="Página siguiente"
                >
                  <IconChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Theme Settings: Soft Accents Picker */}
          <Card className="bg-background border border-premium max-w-sm">
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="font-heading-style font-bold text-xs lowercase">/personalizar_acento</h3>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Aplica un matiz de color suave a botones, gráficos y tarjetas destacadas.
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-1">
                {themes.map((theme) => {
                  const isActive = accentTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setAccentTheme(theme.id)}
                      className={`size-6 rounded-full ${theme.class} border ${
                        isActive
                          ? "border-foreground scale-110 ring-2 ring-foreground/20"
                          : "border-border hover:scale-105"
                      } transition-all duration-200 cursor-pointer`}
                      aria-label={`Acento ${theme.name}`}
                      title={theme.name}
                    />
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in px-4">
          <Card className="max-w-sm w-full bg-card border border-premium shadow-premium-lg relative animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading-style text-sm font-bold tracking-tight text-foreground lowercase flex items-center gap-1.5">
                <IconAlertCircle className="size-4 text-destructive" />
                /confirmar_eliminacion
              </h3>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                aria-label="Cerrar modal"
                disabled={isPending}
              >
                <IconX className="size-4" />
              </Button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <p className="text-muted-foreground leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente el/la {deleteTarget.type === "income" ? "ingreso" : deleteTarget.type === "payment" ? "pago" : "suscripción"}:{" "}
                <span className="text-foreground font-bold font-mono">"{deleteTarget.title}"</span>? Esta acción no se puede deshacer.
              </p>

              <div className="pt-2 flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-center py-2"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                >
                  cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1 justify-center py-2 gap-1.5"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteTarget.action();
                        sileo.success({ title: "Registro eliminado con éxito" });
                        setDeleteTarget(null);
                      } catch (err: any) {
                        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
                          throw err;
                        }
                        sileo.error({ title: err.message || "Error al eliminar" });
                      }
                    });
                  }}
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
        </div>
      )}    </div>
  );
}
