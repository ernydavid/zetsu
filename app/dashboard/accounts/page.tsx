import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/common/sidebar";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/select";
import { addAccount, addTransfer, reconcileAccount } from "@/app/dashboard/actions";
import { computeAccountBalance } from "@/lib/finance/calculations";
import { getFinanceSnapshot } from "@/lib/finance/service";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function AccountsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const snapshot = await getFinanceSnapshot(supabase, user.id);

  if (!snapshot.profile || !snapshot.profile.full_name || !snapshot.profile.base_currency) {
    redirect("/onboarding");
  }

  const profile = snapshot.profile;

  const accountCards = snapshot.accounts.map((account) => ({
    ...account,
    balance: computeAccountBalance(account, snapshot.transactions, ["posted", "reconciled"]),
  }));

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      <Sidebar
        activeTab="accounts"
        profile={profile}
        currency={profile.base_currency}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 lg:py-12 space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                /cuentas_y_conciliacion
              </span>
              <h1 className="font-heading-style text-3xl font-black tracking-tight text-accent-soft-fg lowercase">
                cuentas reales
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                Gestiona dónde vive el dinero, mueve saldo entre cuentas y registra cierres con extracto.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
            <Link href="/dashboard"><Button variant="outline" size="sm">dashboard</Button></Link>
            <Link href="/dashboard/transactions"><Button variant="outline" size="sm">transacciones</Button></Link>
            <Link href="/dashboard/budget"><Button variant="outline" size="sm">presupuesto</Button></Link>
            <Link href="/dashboard/banking"><Button variant="outline" size="sm">banca</Button></Link>
            <Link href="/dashboard/debts"><Button variant="outline" size="sm">deudas</Button></Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {accountCards.map((account) => (
              <Card key={account.id} className="bg-card border border-premium">
                <CardContent className="pt-0 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {account.type.replace("_", " ")}
                    </p>
                    <h2 className="font-heading-style text-xl font-bold lowercase">{account.name}</h2>
                  </div>
                  <p className="text-2xl font-mono font-bold">
                    {formatMoney(account.balance, profile.base_currency)}
                  </p>
                  <div className="text-[10px] font-mono text-muted-foreground space-y-1">
                    <p>saldo inicial: {formatMoney(Number(account.opening_balance), profile.base_currency)}</p>
                    <p>presupuestable: {account.include_in_budget ? "sí" : "no"}</p>
                    <p>origen: {account.origin === "synced" ? `sync/${account.provider ?? "provider"}` : "manual"}</p>
                    <p>
                      última conciliación: {account.last_reconciled_at ?? "sin conciliar"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="bg-card border border-premium xl:col-span-1">
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-lg font-bold lowercase">/nueva_cuenta</h2>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Agrega efectivo, ahorro, tarjeta o préstamo.
                  </p>
                </div>
                <form action={addAccount} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="account-name">Nombre</Label>
                    <Input id="account-name" name="name" placeholder="Caja de ahorro" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="account-type">Tipo</Label>
                    <FormSelect
                      id="account-type"
                      name="type"
                      defaultValue="checking"
                      options={[
                        { value: "checking", label: "checking" },
                        { value: "savings", label: "savings" },
                        { value: "cash", label: "cash" },
                        { value: "credit_card", label: "credit card" },
                        { value: "loan", label: "loan" },
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="opening-balance">Saldo inicial</Label>
                    <Input id="opening-balance" name="opening_balance" type="number" step="0.01" defaultValue="0" required />
                  </div>
                  <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                    <input type="checkbox" name="include_in_budget" defaultChecked />
                    incluir en presupuesto
                  </label>
                  <Button type="submit" variant="soft" className="w-full justify-center">
                    guardar cuenta
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-card border border-premium xl:col-span-1">
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-lg font-bold lowercase">/transferencia</h2>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Mueve dinero entre cuentas sin afectar el patrimonio neto.
                  </p>
                </div>
                <form action={addTransfer} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="from-account">Desde</Label>
                    <FormSelect
                      id="from-account"
                      name="from_account_id"
                      defaultValue={snapshot.accounts[0]?.id}
                      options={snapshot.accounts.map((account) => ({
                        value: account.id,
                        label: account.name,
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="to-account">Hacia</Label>
                    <FormSelect
                      id="to-account"
                      name="to_account_id"
                      defaultValue={snapshot.accounts[0]?.id}
                      options={snapshot.accounts.map((account) => ({
                        value: account.id,
                        label: account.name,
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="transfer-amount">Monto</Label>
                    <Input id="transfer-amount" name="amount" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="transfer-date">Fecha</Label>
                    <Input id="transfer-date" name="transaction_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="transfer-notes">Notas</Label>
                    <Input id="transfer-notes" name="notes" placeholder="Mover ahorro a cuenta corriente" />
                  </div>
                  <Button type="submit" variant="soft" className="w-full justify-center">
                    registrar transferencia
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-card border border-premium xl:col-span-1">
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-lg font-bold lowercase">/conciliar</h2>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Cierra una cuenta contra tu extracto y marca movimientos como conciliados.
                  </p>
                </div>
                <form action={reconcileAccount} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="reconcile-account">Cuenta</Label>
                    <FormSelect
                      id="reconcile-account"
                      name="account_id"
                      defaultValue={snapshot.accounts[0]?.id}
                      options={snapshot.accounts.map((account) => ({
                        value: account.id,
                        label: account.name,
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="statement-date">Fecha de corte</Label>
                    <Input id="statement-date" name="statement_ending_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="statement-balance">Saldo del extracto</Label>
                    <Input id="statement-balance" name="statement_balance" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reconciled-balance">Saldo conciliado</Label>
                    <Input id="reconciled-balance" name="reconciled_balance" type="number" step="0.01" required />
                  </div>
                  <Button type="submit" variant="soft" className="w-full justify-center">
                    guardar conciliación
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
