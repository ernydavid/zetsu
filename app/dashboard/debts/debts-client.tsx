"use client";

import * as React from "react";
import { AppLogo } from "@/components/common/app-logo";
import { AnimatedModal } from "@/components/common/animated-modal";
import { HelpIconButton } from "@/components/common/help-icon-button";
import { Sidebar } from "@/components/common/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/select";
import {
  deleteDebtObligation,
  recordDebtPayment,
  upsertDebtObligation,
} from "@/app/dashboard/actions";
import { todayLocalIso } from "@/lib/finance/dates";
import { sileo } from "sileo";
import {
  computeRecommendedExtraPayment,
  getDebtEstimatedMonthsRemaining,
  getDebtMonthlyCommitment,
  getDebtTypeLabel,
} from "@/lib/finance/debt-utils";
import {
  IconAlertCircle,
  IconChevronRight,
  IconCreditCard,
  IconLoader2,
  IconMenu2,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";

interface DebtsClientProps {
  profile: any;
  accounts: any[];
  debts: any[];
  availableBalance: number;
  availableAfterDebtMinimums: number;
  debtTotals: {
    outstanding: number;
    minimums: number;
    targets: number;
  };
  errorMsg?: string;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function DebtDialogShell({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatedModal
      open={open}
      overlayClassName="flex items-end justify-center bg-background/80 px-4 py-4 backdrop-blur-md sm:items-center"
      panelClassName="w-full max-w-2xl"
    >
      <Card className="w-full max-w-2xl space-y-5 border border-premium bg-card p-5 shadow-premium-lg sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-muted-foreground">
              {title}
            </p>
            <p className="max-w-xl text-[11px] font-mono leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
          <Button type="button" size="icon-sm" variant="outline" onClick={onClose} aria-label="Cerrar diálogo">
            <IconX className="size-4" />
          </Button>
        </div>
        {children}
      </Card>
    </AnimatedModal>
  );
}

export function DebtsClient({
  profile,
  accounts,
  debts,
  availableBalance,
  availableAfterDebtMinimums,
  debtTotals,
  errorMsg,
}: DebtsClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [editingDebt, setEditingDebt] = React.useState<any | null>(null);
  const [paymentDebtId, setPaymentDebtId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<any | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const activeDebts = React.useMemo(
    () => debts.filter((debt) => debt.status === "active" || debt.status === "paused"),
    [debts],
  );
  const selectedDebt = activeDebts.find((debt) => debt.id === paymentDebtId) ?? null;

  React.useEffect(() => {
    if (!errorMsg) {
      return;
    }

    const decoded = decodeURIComponent(errorMsg);
    sileo.error({ title: decoded });
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [errorMsg]);

  const handleDebtAction = async (
    actionFn: (fd: FormData) => Promise<void>,
    formData: FormData,
    options: {
      successMessage: string;
      onSuccess?: () => void;
    },
  ) => {
    startTransition(async () => {
      try {
        await actionFn(formData);
        sileo.success({ title: options.successMessage });
        options.onSuccess?.();
      } catch (err: any) {
        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }

        sileo.error({ title: err?.message || "Ocurrió un error inesperado" });
      }
    });
  };

  const handleDeleteDebt = async () => {
    if (!deleteTarget?.id) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteDebtObligation(deleteTarget.id);
        sileo.success({ title: "Deuda eliminada con éxito" });
        setDeleteTarget(null);
      } catch (err: any) {
        sileo.error({ title: err?.message || "No se pudo eliminar la deuda" });
      }
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col lg:flex-row">
      <Sidebar activeTab="debts" profile={profile} currency={profile.base_currency} />

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-premium bg-card px-6 py-4 lg:hidden">
        <div className="flex items-center space-x-2">
          <AppLogo size="sm" variant="full" priority />
          <span className="rounded-full border border-accent-soft-border bg-accent-soft-bg px-2 py-0.5 text-[9px] font-mono font-bold uppercase text-accent-soft-fg">
            {profile.billing_tier}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <HelpIconButton onClick={() => setIsHelpOpen(true)} />
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

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/90 p-6 backdrop-blur-md lg:hidden">
          <div className="mb-8 flex items-center justify-between">
            <AppLogo size="sm" variant="full" />
            <Button size="icon-sm" variant="outline" onClick={() => setIsMobileMenuOpen(false)}>
              <IconX className="size-4" />
            </Button>
          </div>

          <nav className="flex-1 space-y-4">
            <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 rounded-xl border border-transparent px-4 py-3 text-sm text-muted-foreground">
              <IconChevronRight className="size-4 rotate-180" />
              <span className="text-xs font-mono uppercase tracking-wider">dashboard</span>
            </Link>
            <Link href="/dashboard/transactions" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 rounded-xl border border-transparent px-4 py-3 text-sm text-muted-foreground">
              <IconReceipt className="size-4" />
              <span className="text-xs font-mono uppercase tracking-wider">transacciones</span>
            </Link>
            <Link href="/dashboard/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 rounded-xl border border-transparent px-4 py-3 text-sm text-muted-foreground">
              <IconSettings className="size-4" />
              <span className="text-xs font-mono uppercase tracking-wider">ajustes</span>
            </Link>
          </nav>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:py-12">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                /deudas
              </span>
              <div className="space-y-1">
                <h1 className="font-heading-style text-3xl font-black lowercase tracking-tight text-accent-soft-fg">
                  control de deudas
                </h1>
                <p className="max-w-2xl text-[11px] font-mono leading-relaxed text-muted-foreground">
                  Revisa tus obligaciones activas, cuánto debes cubrir este mes y registra pagos sin salir de una vista más limpia.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start">
              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() => {
                  setEditingDebt(null);
                  setIsCreateOpen(true);
                }}
              >
                <IconPlus className="size-3.5" />
                nueva deuda
              </Button>
              <HelpIconButton onClick={() => setIsHelpOpen(true)} />
            </div>
          </div>

          {errorMsg ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-mono text-destructive">
              {decodeURIComponent(errorMsg)}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card className="space-y-1 border border-premium px-4 py-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">deuda viva</p>
              <p className="text-xl font-mono font-bold">{formatMoney(debtTotals.outstanding, profile.base_currency)}</p>
            </Card>
            <Card className="space-y-1 border border-premium px-4 py-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">cuotas del mes</p>
              <p className="text-xl font-mono font-bold">{formatMoney(debtTotals.minimums, profile.base_currency)}</p>
            </Card>
            <Card className="space-y-1 border border-premium px-4 py-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">tras cuotas</p>
              <p className="text-xl font-mono font-bold">{formatMoney(availableAfterDebtMinimums, profile.base_currency)}</p>
            </Card>
            <Card className="space-y-1 border border-accent-soft-border bg-accent-soft-bg px-4 py-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-soft-fg/80">caja base</p>
              <p className="text-xl font-mono font-bold text-accent-soft-fg">{formatMoney(availableBalance, profile.base_currency)}</p>
            </Card>
          </div>

          <Card className="space-y-4 border border-premium px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-heading-style text-lg font-bold lowercase">/deudas_activas</h2>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Vista resumida de saldos, cuota mensual, vencimiento y pagos sugeridos.
                </p>
              </div>
              <span className="rounded-full border border-premium px-2.5 py-1 text-[10px] font-mono uppercase text-muted-foreground">
                {activeDebts.length} activas
              </span>
            </div>

            {activeDebts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-premium px-5 py-10 text-center text-xs font-mono text-muted-foreground">
                No hay deudas activas todavía. Cuando quieras, registra la primera desde el botón superior.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {activeDebts.map((debt) => {
                  const currentBalance = Number(debt.current_balance ?? 0);
                  const originalBalance = Math.max(Number(debt.original_balance ?? 0), currentBalance, 1);
                  const progress = Math.min(100, Math.max(0, ((originalBalance - currentBalance) / originalBalance) * 100));
                  const recommended = computeRecommendedExtraPayment({
                    debt,
                    availableBalance,
                    totalMinimums: debtTotals.minimums,
                    activeDebtCount: Math.max(1, activeDebts.length),
                  });
                  const monthlyCommitment = getDebtMonthlyCommitment(debt);
                  const monthlyTarget = Number(debt.payment_target ?? 0);
                  const estimatedMonths = getDebtEstimatedMonthsRemaining(debt);
                  const paymentAccount = accounts.find((account) => account.id === debt.payment_account_id);

                  return (
                    <div key={debt.id} className="rounded-2xl border border-premium bg-card px-4 py-4 font-mono text-xs shadow-premium">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex size-9 items-center justify-center rounded-xl border border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg">
                              <IconCreditCard className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-foreground">{debt.name}</p>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                {getDebtTypeLabel(debt.debt_type)} · vence cada mes el dia {debt.due_day}
                              </p>
                            </div>
                          </div>
                        </div>
                        <span className="rounded-full border border-accent-soft-border bg-accent-soft-bg px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-accent-soft-fg">
                          {debt.status}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-premium bg-background px-3 py-2">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">pendiente</p>
                          <p className="mt-1 font-bold">{formatMoney(currentBalance, debt.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-premium bg-background px-3 py-2">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">recomendado</p>
                          <p className="mt-1 font-bold">{formatMoney(recommended, debt.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-premium bg-background px-3 py-2">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">pago mínimo</p>
                          <p className="mt-1 font-bold">{formatMoney(monthlyCommitment, debt.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-premium bg-background px-3 py-2">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">meta mensual</p>
                          <p className="mt-1 font-bold">
                            {monthlyTarget > 0
                              ? formatMoney(monthlyTarget, debt.currency)
                              : formatMoney(monthlyCommitment, debt.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-premium bg-background px-3 py-2">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">meses estimados</p>
                          <p className="mt-1 font-bold">{estimatedMonths ?? "--"}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>avance</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/35">
                          <div
                            className="h-full rounded-full bg-accent-soft-fg transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
                        <p className="min-w-0 truncate">paga desde: {paymentAccount?.name ?? "sin cuenta"}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => {
                              setEditingDebt(debt);
                              setIsCreateOpen(false);
                            }}
                            aria-label={`Editar ${debt.name}`}
                          >
                            <IconPencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => setDeleteTarget(debt)}
                            aria-label={`Eliminar ${debt.name}`}
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setPaymentDebtId(debt.id)}>
                            registrar pago
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </main>

      {isCreateOpen || editingDebt ? (
        <DebtDialogShell
          open={isCreateOpen || !!editingDebt}
          title={editingDebt ? "/editar_deuda" : "/registrar_deuda"}
          subtitle={
            editingDebt
              ? "Ajusta saldo, pago mínimo, meta mensual y vencimiento sin perder el historial de seguimiento."
              : "Registra una deuda con saldo vivo, pago mínimo, meta mensual y el día en que quieres verla reflejada en tu agenda."
          }
          onClose={() => {
            setIsCreateOpen(false);
            setEditingDebt(null);
          }}
        >
          <form
            action={(formData) =>
              handleDebtAction(upsertDebtObligation, formData, {
                successMessage: editingDebt
                  ? "Deuda actualizada con éxito"
                  : "Deuda guardada con éxito",
                onSuccess: () => {
                  setIsCreateOpen(false);
                  setEditingDebt(null);
                },
              })
            }
            className="grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-2"
          >
            {editingDebt ? <input type="hidden" name="id" value={editingDebt.id} /> : null}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="debt-name">Nombre</Label>
              <Input
                id="debt-name"
                name="name"
                placeholder="Tarjeta principal"
                defaultValue={editingDebt?.name ?? ""}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-type">Tipo</Label>
              <FormSelect
                id="debt-type"
                name="debt_type"
                defaultValue={editingDebt?.debt_type ?? "credit_card"}
                options={[
                  { value: "credit_card", label: "tarjeta de crédito" },
                  { value: "loan", label: "préstamo" },
                  { value: "mortgage", label: "hipoteca" },
                  { value: "personal", label: "deuda personal" },
                  { value: "tax", label: "impuestos" },
                  { value: "other", label: "otro" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-due-day">Día de vencimiento</Label>
              <Input
                id="debt-due-day"
                name="due_day"
                type="number"
                min="1"
                max="31"
                defaultValue={editingDebt?.due_day ?? "15"}
                required
              />
              <p className="text-[10px] text-muted-foreground">Se usará para ubicar esta deuda en la agenda cada mes.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-original">Deuda inicial</Label>
              <Input
                id="debt-original"
                name="original_balance"
                type="number"
                step="0.01"
                defaultValue={editingDebt?.original_balance ?? "0"}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                El monto con el que quieres empezar a seguir esta deuda en Zetsu.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-current">Pendiente hoy</Label>
              <Input
                id="debt-current"
                name="current_balance"
                type="number"
                step="0.01"
                defaultValue={editingDebt?.current_balance ?? "0"}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Lo que realmente debes ahora mismo y te falta pagar.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-payment-minimum">Pago mínimo mensual</Label>
              <Input
                id="debt-payment-minimum"
                name="payment_minimum"
                type="number"
                step="0.01"
                defaultValue={editingDebt?.payment_minimum ?? editingDebt?.installment_amount ?? "0"}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                El compromiso mensual mínimo que debes cubrir para mantener esta deuda al día.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-payment-target">Pago objetivo mensual</Label>
              <Input
                id="debt-payment-target"
                name="payment_target"
                type="number"
                step="0.01"
                defaultValue={editingDebt?.payment_target ?? "0"}
              />
              <p className="text-[10px] text-muted-foreground">
                Si quieres acelerar esta deuda, define aquí el monto mensual que idealmente quieres destinarle.
              </p>
            </div>
            <div className="flex gap-2 pt-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingDebt(null);
                }}
                disabled={isPending}
              >
                cancelar
              </Button>
              <Button type="submit" variant="soft" className="flex-1 justify-center" disabled={isPending}>
                {isPending ? <IconLoader2 className="mr-2 size-3.5 animate-spin" /> : null}
                {editingDebt ? "guardar cambios" : "guardar deuda"}
              </Button>
            </div>
          </form>
        </DebtDialogShell>
      ) : null}

      {selectedDebt ? (
        <DebtDialogShell
          open={!!selectedDebt}
          title="/registrar_pago"
          subtitle={`Aplica un pago a ${selectedDebt.name} y descuéntalo del saldo pendiente.`}
          onClose={() => setPaymentDebtId(null)}
        >
          <form
            action={(formData) =>
              handleDebtAction(recordDebtPayment, formData, {
                successMessage: "Pago registrado con éxito",
                onSuccess: () => setPaymentDebtId(null),
              })
            }
            className="grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-2"
          >
            <input type="hidden" name="debt_id" value={selectedDebt.id} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="payment-account">Cuenta de pago</Label>
              <FormSelect
                id="payment-account"
                name="payment_account_id"
                defaultValue={selectedDebt.payment_account_id}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-amount">Monto pago</Label>
              <Input
                id="payment-amount"
                name="amount"
                type="number"
                step="0.01"
                defaultValue={getDebtMonthlyCommitment(selectedDebt)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-principal">Aplicado a capital</Label>
              <Input
                id="payment-principal"
                name="principal_amount"
                type="number"
                step="0.01"
                defaultValue={getDebtMonthlyCommitment(selectedDebt)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-interest">Interés</Label>
              <Input id="payment-interest" name="interest_amount" type="number" step="0.01" defaultValue="0" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-fee">Comisiones</Label>
              <Input id="payment-fee" name="fee_amount" type="number" step="0.01" defaultValue="0" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-date">Fecha</Label>
              <Input id="payment-date" name="transaction_date" type="date" defaultValue={todayLocalIso()} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-notes">Notas</Label>
              <Input id="payment-notes" name="notes" placeholder="Abono extraordinario" />
            </div>
            <div className="flex gap-2 pt-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => setPaymentDebtId(null)}
                disabled={isPending}
              >
                cancelar
              </Button>
              <Button type="submit" variant="soft" className="flex-1 justify-center" disabled={isPending}>
                {isPending ? <IconLoader2 className="mr-2 size-3.5 animate-spin" /> : null}
                registrar pago
              </Button>
            </div>
          </form>
        </DebtDialogShell>
      ) : null}

      {deleteTarget ? (
        <DebtDialogShell
          open={!!deleteTarget}
          title="/confirmar_eliminacion"
          subtitle={`Vas a eliminar ${deleteTarget.name}. Se borrará su seguimiento y se desvincularán sus asignaciones de deuda.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
              Esta acción no se puede deshacer.
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
              >
                cancelar
              </Button>
              <Button
                type="button"
                variant="soft"
                className="flex-1 justify-center"
                onClick={handleDeleteDebt}
                disabled={isPending}
              >
                {isPending ? <IconLoader2 className="mr-2 size-3.5 animate-spin" /> : null}
                eliminar deuda
              </Button>
            </div>
          </div>
        </DebtDialogShell>
      ) : null}

      {isHelpOpen ? (
        <DebtDialogShell
          open={isHelpOpen}
          title="/ayuda_deudas"
          subtitle="Resumen rápido de lo que puedes hacer aquí."
          onClose={() => setIsHelpOpen(false)}
        >
          <div className="space-y-3 font-mono text-xs text-muted-foreground">
            <div className="rounded-xl border border-premium bg-muted/10 px-3 py-3">
              Revisa tus deudas activas, el pago mínimo del mes y cuánto margen te queda después de cubrirlo.
            </div>
            <div className="rounded-xl border border-premium bg-muted/10 px-3 py-3">
              Usa `nueva deuda` para registrar saldo, pago mínimo y meta mensual; luego usa `registrar pago` para descontarla del saldo.
            </div>
            <div className="rounded-xl border border-premium bg-muted/10 px-3 py-3">
              Si quieres asociar un gasto real a una deuda, ahora lo haces desde `transacciones`.
            </div>
          </div>
        </DebtDialogShell>
      ) : null}
    </div>
  );
}
