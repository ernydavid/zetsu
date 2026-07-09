import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/common/sidebar";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  disconnectBankConnection,
  initiateBankConnection,
  reconnectTinkConsent,
  refreshBankConnection,
} from "@/app/dashboard/actions";
import {
  getBankConnectionDisplayState,
  getBankingProviderRuntimeStatus,
  getInstitutionOperationalHint,
} from "@/lib/finance/banking";
import { getFinanceSnapshot } from "@/lib/finance/service";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function statusClassName(tone: string) {
  switch (tone) {
    case "connected":
    case "sandbox":
      return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700";
    case "waiting_widget":
    case "waiting_webhook":
    case "syncing":
      return "border-sky-500/30 bg-sky-500/5 text-sky-700";
    case "manual_only":
      return "border-amber-500/30 bg-amber-500/5 text-amber-700";
    case "requires_reconnection":
    case "disconnected":
      return "border-destructive/30 bg-destructive/5 text-destructive";
    default:
      return "border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg";
  }
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BankingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMsg = typeof params.error === "string" ? params.error : undefined;
  const noticeMsg = typeof params.notice === "string" ? params.notice : undefined;

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
  const tinkRuntime = getBankingProviderRuntimeStatus("tink");
  const belvoRuntime = getBankingProviderRuntimeStatus("belvo");

  const groupedInstitutions = snapshot.supportedInstitutions.reduce(
    (accumulator: Record<string, typeof snapshot.supportedInstitutions>, institution) => {
      if (!accumulator[institution.country_code]) {
        accumulator[institution.country_code] = [];
      }
      accumulator[institution.country_code].push(institution);
      return accumulator;
    },
    {},
  );

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      <Sidebar activeTab="banking" profile={profile} currency={profile.base_currency} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 lg:py-12 space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                /conexiones_bancarias
              </span>
              <h1 className="font-heading-style text-3xl font-black tracking-tight text-accent-soft-fg lowercase">
                banca conectada
              </h1>
              <p className="text-xs text-muted-foreground font-mono max-w-3xl">
                Sincroniza cuentas y movimientos en modo solo lectura. Tink queda preparado para Espana y Belvo para Colombia, manteniendo sandbox y respaldo manual mientras configuras credenciales reales.
              </p>
            </div>
            <ThemeToggle />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-mono text-destructive">
              {decodeURIComponent(errorMsg)}
            </div>
          )}

          {noticeMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs font-mono text-emerald-700">
              {decodeURIComponent(noticeMsg)}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
            <Link href="/dashboard"><Button variant="outline" size="sm">dashboard</Button></Link>
            <Link href="/dashboard/accounts"><Button variant="outline" size="sm">cuentas</Button></Link>
            <Link href="/dashboard/transactions"><Button variant="outline" size="sm">transacciones</Button></Link>
            <Link href="/dashboard/debts"><Button variant="outline" size="sm">deudas</Button></Link>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-lg font-bold lowercase">/nueva_conexion</h2>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    España arranca con Tink ({tinkRuntime.label}). Colombia arranca en piloto/hibrido con Belvo ({belvoRuntime.label}) y fallback manual para instituciones no habilitadas.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(groupedInstitutions).map(([countryCode, institutions]) => (
                    <Card key={countryCode} className="border border-premium bg-background">
                      <CardContent className="pt-0 space-y-4">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            {countryCode === "ES" ? "españa" : "colombia"}
                          </p>
                          <h3 className="font-heading-style text-xl font-bold lowercase">
                            {countryCode === "ES" ? "PSD2 · Tink" : "piloto · Belvo"}
                          </h3>
                        </div>

                        <div className="space-y-3">
                          {institutions.map((institution) => (
                            <form key={institution.id} action={initiateBankConnection} className="rounded-2xl border border-premium bg-card p-4 space-y-3 font-mono text-xs">
                              <input type="hidden" name="country_code" value={institution.country_code} />
                              <input type="hidden" name="institution_id" value={institution.id} />
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-foreground">{institution.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {institution.capabilities.join(" · ")}
                                  </p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {getInstitutionOperationalHint(institution)}
                                  </p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-wider border ${
                                  institution.availability === "manual_only"
                                    ? "border-amber-500/30 text-amber-600 bg-amber-500/5"
                                    : institution.availability === "pilot"
                                      ? "border-sky-500/30 text-sky-600 bg-sky-500/5"
                                      : "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                                }`}>
                                  {institution.availability === "manual_only" ? "manual" : institution.availability}
                                </span>
                              </div>

                              <Button type="submit" variant={institution.availability === "manual_only" ? "outline" : "soft"} className="w-full justify-center">
                                {institution.availability === "manual_only"
                                  ? "guardar fallback manual"
                                  : institution.provider === "tink" && tinkRuntime.configured
                                    ? "abrir tink link"
                                  : institution.provider === "belvo" && belvoRuntime.configured
                                    ? "abrir widget belvo"
                                    : "conectar en sandbox"}
                              </Button>
                            </form>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-lg font-bold lowercase">/estado_actual</h2>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Cuentas enlazadas: {snapshot.bankConnections.length} · cuentas externas: {snapshot.externalAccounts.length}
                  </p>
                </div>

                {snapshot.bankConnections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-premium p-6 text-xs font-mono text-muted-foreground">
                    Aún no hay conexiones guardadas. Puedes seguir usando ingresos y movimientos manuales exactamente como hasta ahora.
                  </div>
                ) : (
                  snapshot.bankConnections.map((connection) => {
                    const relatedAccounts = snapshot.externalAccounts.filter(
                      (account) => account.bank_connection_id === connection.id,
                    );
                    const displayState = getBankConnectionDisplayState(connection);

                    return (
                      <div key={connection.id} className="rounded-2xl border border-premium p-4 space-y-4 font-mono text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-foreground">{connection.institution_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {connection.country_code} · {connection.provider} · modo {connection.connection_mode}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {displayState.detail}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider ${statusClassName(displayState.tone)}`}>
                            {displayState.label}
                          </span>
                        </div>

                        {connection.visible_error && (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-700">
                            {connection.visible_error}
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-premium bg-background px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ultima sync</p>
                            <p className="mt-1 font-bold text-foreground">
                              {connection.last_synced_at
                                ? new Date(connection.last_synced_at).toLocaleString("es-CO")
                                : "sin sincronizar"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-premium bg-background px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">modo operativo</p>
                            <p className="mt-1 font-bold text-foreground">
                              {connection.connection_mode === "live"
                                ? connection.provider === "tink"
                                  ? "Tink real"
                                  : "Belvo real"
                                : connection.connection_mode === "manual_only"
                                  ? "manual"
                                  : "sandbox local"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {relatedAccounts.length === 0 ? (
                            <p className="text-muted-foreground">Sin cuentas externas materializadas todavía.</p>
                          ) : (
                            relatedAccounts.map((account) => (
                              <div key={account.id} className="flex items-center justify-between rounded-xl border border-premium bg-background px-3 py-2">
                                <div>
                                  <p className="font-bold">{account.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {account.type} · {account.sync_state}
                                  </p>
                                </div>
                                <p className="font-bold">
                                  {formatMoney(Number(account.current_balance), profile.base_currency)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="flex gap-2">
                          <form action={refreshBankConnection} className="flex-1">
                            <input type="hidden" name="connection_id" value={connection.id} />
                            <Button type="submit" variant="soft" className="w-full justify-center">refrescar</Button>
                          </form>
                          {connection.provider === "tink" && displayState.tone === "requires_reconnection" && (
                            <form action={reconnectTinkConsent} className="flex-1">
                              <input type="hidden" name="connection_id" value={connection.id} />
                              <Button type="submit" variant="soft" className="w-full justify-center">reconfirmar</Button>
                            </form>
                          )}
                          <form action={disconnectBankConnection} className="flex-1">
                            <input type="hidden" name="connection_id" value={connection.id} />
                            <Button type="submit" variant="outline" className="w-full justify-center">desvincular</Button>
                          </form>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border border-premium">
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-1">
                <h2 className="font-heading-style text-lg font-bold lowercase">/movimientos_externos_recientes</h2>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Vista cruda normalizada del proveedor, separada del ledger interno para auditoría y conciliación.
                </p>
              </div>

              {snapshot.externalTransactions.length === 0 ? (
                <p className="text-xs font-mono text-muted-foreground">Sin movimientos externos sincronizados todavía.</p>
              ) : (
                <div className="space-y-2">
                  {snapshot.externalTransactions.slice(0, 12).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between rounded-xl border border-premium bg-background px-3 py-2 font-mono text-xs">
                      <div>
                        <p className="font-bold text-foreground">{transaction.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {transaction.provider} · {transaction.status} · {transaction.posted_date ?? transaction.authorized_date}
                        </p>
                      </div>
                      <p className={transaction.direction === "credit" ? "text-emerald-600 font-bold" : "text-destructive font-bold"}>
                        {transaction.direction === "credit" ? "+" : "-"}
                        {formatMoney(Number(transaction.amount), transaction.currency || profile.base_currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
